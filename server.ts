import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY 
});

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // AI OCR Parser Route
  app.post("/api/parse-ocr", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "No text provided" });

      const prompt = `
        Aşağıdaki metin bir haftalık ders programı veya sınav takvimi görselinden OCR ile taranmıştır. 
        Lütfen bu metni analiz et ve SADECE JSON formatında bir veri döndür.
        
        KRİTİK KURALLAR:
        1. ÖĞRETMEN İSİMLERİNİ KESİNLİKLE SİL: "M.YLD", "E.ÇLB", "Ö.MUT", "T.KYA", "A.KNG", "R.AYD", "S.ÇKR", "Ö.EGİ", "Z.DND", "H.KYA", "M.ŞMŞ", "E.BRN" gibi formatları (Bir harf, nokta ve soyisim) asla ders olarak alma. Bunlar hücrenin alt satırındaki öğretmen isimleridir.
        2. TEKRARLARI ÖNLE: Bir gün içinde aynı saatte SADECE BİR ders olabilir. Eğer OCR metni aynı dersi peş peşe birden fazla kez okumuşsa (noise), mantıklı olan ders sayısını (günde 6-8 ders) koru.
        3. DERS ADLARINI DÜZELT:
           - MATEM / MAT / MAT5 / MATEM5 -> Matematik
           - TÜRKÇ / TÜRK / TÜRKÇ5 -> Türkçe
           - F.BİL / FEN / FBİL / F.BİL4 -> Fen Bilimleri
           - Y.DİL / İNG / YDİL / Y.DİL4 -> Yabancı Dil (İngilizce)
           - DKAB / DİN / DKAB2 -> Din Kültürü ve Ahlak Bilgisi
           - TCİTA / TCİ / İNK / TCİTA2 -> T.C. İnkılap Tarihi ve Atatürkçülük
           - BES / BED / BES2 -> Beden Eğitimi ve Spor
           - G.SAN / GÖR / G.SAN1 -> Görsel Sanatlar
           - MÜZİ / MÜZ / MÜZİK1 -> Müzik
           - REH / REH6 -> Rehberlik
           - K.KER / KUR / K.KER2 -> Kur'an-ı Kerim
           - TT2 / TEK / TEK.TAS -> Teknoloji ve Tasarım
           - YZU2 / YZU / BİL -> Yapay Zeka Uygulamaları
           - BTY / BİLİŞİM -> Bilişim Teknolojileri ve Yazılım
           - MD2 / MEDYA -> Medya Okuryazarlığı
        4. GÜN VE SAAT EŞLEŞTİRMESİ: 
           Pazartesi=0, Salı=1, Çarşamba=2, Perşembe=3, Cuma=4, Cumartesi=5, Pazar=6.
           Haftalık programda satırlar günleri, sütunlar ders saatlerini temsil eder. Görseldeki düzene sadık kal.
        5. SADECE JSON DÖNDÜR: Yanıt sadece ham JSON olmalı.
        
        HAFTALIK DERS PROGRAMI JSON YAPISI:
        {
          "type": "schedule_list",
          "data": [
            { "subject": "Tam Ders Adı", "day": 0, "startTime": "08:30", "endTime": "09:10" }
          ]
        }

        SINAV TAKVİMİ JSON YAPISI:
        {
          "type": "exam_list",
          "data": [
            { "title": "Tam Ders Adı", "date": "2024-05-20", "time": "10:00" }
          ]
        }

        OCR Metni:
        ${text}
      `;

      let responseData;

      // Try Groq First (Fast and Optimized for JSON)
      if (process.env.GROQ_API_KEY) {
        try {
          console.log("Groq API isteği gönderiliyor...");
          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "You are a professional data parser. Your task is to convert unstructured text into precise JSON. Respond ONLY with raw JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const content = completion.choices[0]?.message?.content;
          if (content) {
            console.log("Groq yanıtı başarıyla alındı.");
            responseData = JSON.parse(content);
          }
        } catch (groqError: any) {
          console.error("Groq Hatası:", groqError.message || groqError);
          // If it's a decommissioned model error or other 400, strictly fallback
        }
      }

      // Fallback to Gemini with reliable models
      if (!responseData) {
        const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest"];
        let geminiResponse;
        let lastError;

        for (const modelName of modelsToTry) {
          let modelAttempts = 0;
          const maxModelAttempts = 2; 
          let success = false;

          while (modelAttempts < maxModelAttempts) {
            try {
              console.log(`Gemini Deneniyor: ${modelName} (Deneme ${modelAttempts + 1})`);
              geminiResponse = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                  responseMimeType: "application/json"
                }
              });
              
              if (geminiResponse && geminiResponse.text) {
                const cleanedText = geminiResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
                responseData = JSON.parse(cleanedText);
                success = true;
                console.log(`Gemini (${modelName}) başarıyla sonuçlandı.`);
                break;
              }
              throw new Error("Boş yanıt alındı.");
            } catch (error: any) {
              modelAttempts++;
              lastError = error;
              console.log(`${modelName} hata:`, error.message || error);
              
              const errCode = error.code || (error.error && error.error.code);
              const errStatus = error.status || (error.error && error.error.status);

              // Retry on busy/quota
              if ((errCode === 429 || errCode === 503 || errStatus === 'UNAVAILABLE' || errStatus === 'RESOURCE_EXHAUSTED' || errStatus === 'INTERNAL') && modelAttempts < maxModelAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000)); 
                continue;
              }
              break; 
            }
          }
          if (success) break;
        }

        if (!responseData) throw lastError || new Error("Sistem şu an çok yoğun, lütfen az sonra tekrar deneyiniz.");
      }

      // Final data validation
      if (responseData && (!responseData.type || !Array.isArray(responseData.data))) {
        throw new Error("Geçersiz veri formatı oluşturuldu.");
      }

      res.json(responseData);
    } catch (error: any) {
      console.error("AI Parse Error:", error);
      
      let statusCode = 500;
      let errorMessage = "Yapay zeka analizi sırasında bir hata oluştu.";

      // Handle the specialized error formats from the SDK
      if (error && typeof error === 'object') {
        const errStatus = error.status || (error.error && error.error.status);
        const errCode = error.code || (error.error && error.error.code);
        const errMsg = error.message || (error.error && error.error.message);

        if (errCode === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
          statusCode = 429;
          errorMessage = "Günlük ücretsiz kullanım kotası dolmuştur. Lütfen 30 saniye bekleyip tekrar deneyiniz.";
        } else if (errCode === 503 || errStatus === 'UNAVAILABLE') {
          statusCode = 503;
          errorMessage = "Yapay zeka şu an çok yoğun. Otomatik olarak tekrar deneniyor, lütfen bekleyiniz...";
        } else if (errCode === 400 || errStatus === 'INVALID_ARGUMENT') {
          statusCode = 400;
          errorMessage = "Görsel içeriği anlaşılamadı. Lütfen ışığın iyi olduğu daha net bir görsel yükleyiniz.";
        } else if (errMsg) {
          errorMessage = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        }

        if (typeof errCode === 'number') statusCode = errCode;
      }

      res.status(statusCode).json({ 
        error: errorMessage,
        details: error.details || []
      });
    }
  });

  // AI Chat Assistant Route
  app.post("/api/ai-chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "No message provided" });

      const prompt = `
        Kullanıcıdan gelen şu ders/sınav bilgilerini analiz et ve JSON formatında döndür:
        "${message}"
        
        KURALLAR:
        1. Eğer kullanıcı ders programı bilgisi veriyorsa (Örn: "Pazartesi 8:30 matematik"), "type": "schedule_list" olarak işaretle.
        2. Eğer kullanıcı sınav bilgisi veriyorsa (Örn: "20 Mayıs 10:00 matematik sınavı"), "type": "exam_list" olarak işaretle.
        3. Ders adlarını tam ve düzgün hallerine çevir.
        4. Gün eşleşmesi: Pazartesi=0, Salı=1, Çarşamba=2, Perşembe=3, Cuma=4, Cumartesi=5, Pazar=6.
        5. Saatler HH:mm formatında olmalı.
        6. Tarihler YYYY-MM-DD formatında olmalı. (Eğer yıl belirtilmemişse 2024 varsay).
        
        HAFTALIK DERS PROGRAMI JSON YAPISI:
        {
          "type": "schedule_list",
          "data": [
            { "subject": "Ders Adı", "day": 0, "startTime": "HH:mm", "endTime": "HH:mm" }
          ]
        }

        SINAV TAKVİMİ JSON YAPISI:
        {
          "type": "exam_list",
          "data": [
            { "title": "Sınav/Ders Adı", "date": "YYYY-MM-DD", "time": "HH:mm" }
          ]
        }
        
        SADECE JSON DÖNDÜR.
      `;

      let responseData;

      // Try Groq First
      if (process.env.GROQ_API_KEY) {
        try {
          const completion = await groq.chat.completions.create({
            messages: [
              { role: "system", content: "You are a professional assistant. Convert natural language into schedule/exam JSON. ONLY JSON." },
              { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
          });
          const content = completion.choices[0]?.message?.content;
          if (content) responseData = JSON.parse(content);
        } catch (e) {
          console.error("Assistant Groq Error:", e);
        }
      }

      if (!responseData) {
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        if (result && result.text) {
          const rawText = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
          console.log("Raw AI Response:", rawText);
          responseData = JSON.parse(rawText);
        }
      }

      if (!responseData) throw new Error("Yapay zeka yanıt veremedi.");
      res.json(responseData);
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: "Asistan şu an yanıt veremiyor." });
    }
  });

  // Dedicated 404 for API routes to prevent falling through to SPA fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
