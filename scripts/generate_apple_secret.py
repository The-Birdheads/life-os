"""
Apple Sign in with Apple - Secret Key (client_secret JWT) generator
Supabase の Apple プロバイダー設定に使用するJWTを生成します

Usage:
  python3 scripts/generate_apple_secret.py \
    --team-id  <Team ID>  \
    --key-id   <Key ID>   \
    --key-file <path to .p8 file>
"""

import argparse
import time
import json
import base64
import struct
import hmac
import hashlib
import sys


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def load_p8_key(path: str) -> bytes:
    with open(path, "r") as f:
        content = f.read()
    # PEMヘッダー/フッターを除去してbase64デコード
    lines = [l.strip() for l in content.splitlines()
             if l.strip() and not l.strip().startswith("-----")]
    return base64.b64decode("".join(lines))


def sign_es256(key_der: bytes, message: bytes) -> bytes:
    """ES256 署名（ecdsa モジュール不要・pure Python）"""
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend

        private_key = serialization.load_der_private_key(
            key_der, password=None, backend=default_backend()
        )
        signature_der = private_key.sign(message, ec.ECDSA(hashes.SHA256()))

        # DER → (r, s) raw 64バイト形式に変換
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        r, s = decode_dss_signature(signature_der)
        return r.to_bytes(32, "big") + s.to_bytes(32, "big")

    except ImportError:
        print("Error: 'cryptography' ライブラリが必要です")
        print("インストール: python3 -m pip install cryptography")
        sys.exit(1)


def generate_client_secret(team_id: str, key_id: str, key_der: bytes) -> str:
    now = int(time.time())
    exp = now + 15_777_000  # 約6ヶ月（Appleの上限）

    header = {"alg": "ES256", "kid": key_id}
    payload = {
        "iss": team_id,
        "iat": now,
        "exp": exp,
        "aud": "https://appleid.apple.com",
        "sub": "com.morikuma.habitas",
    }

    header_b64 = base64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = base64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()

    signature = sign_es256(key_der, signing_input)
    sig_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apple client_secret JWT generator")
    parser.add_argument("--team-id",  required=True, help="Apple Developer Team ID")
    parser.add_argument("--key-id",   required=True, help="Sign in with Apple Key ID")
    parser.add_argument("--key-file", required=True, help="Path to .p8 private key file")
    args = parser.parse_args()

    key_der = load_p8_key(args.key_file)
    token = generate_client_secret(args.team_id, args.key_id, key_der)

    print("\n=== Supabase に貼り付けるSecret Key ===\n")
    print(token)
    print("\n=======================================")
    print("※ このJWTの有効期限は約6ヶ月です。期限切れ後は再生成が必要です。")
