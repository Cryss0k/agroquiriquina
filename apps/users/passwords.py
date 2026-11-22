import base64
import hashlib
import hmac
import secrets


PASSWORD_HASH_ITERATIONS = 1_000_000


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,
    )
    encoded_digest = base64.b64encode(digest).decode("ascii")
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${encoded_digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected_digest = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256" or int(iterations) <= 0:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations),
        )
    except (AttributeError, TypeError, ValueError):
        return False
    actual_digest = base64.b64encode(digest).decode("ascii")
    return hmac.compare_digest(actual_digest, expected_digest)


def password_validation_error(password: str) -> str | None:
    requirements = [
        (len(password) >= 8, "8 caracteres como mínimo"),
        (any(char.isupper() for char in password), "una letra mayúscula"),
        (any(char.islower() for char in password), "una letra minúscula"),
        (any(char.isdigit() for char in password), "un número"),
        (any(not char.isalnum() for char in password), "un símbolo"),
    ]
    missing = [requirement for valid, requirement in requirements if not valid]
    if missing:
        return "La contraseña debe incluir " + ", ".join(missing) + "."
    return None
