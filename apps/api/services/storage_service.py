"""
Storage service — abstracts local filesystem vs AWS S3 vs Postgres DB.
Switch via STORAGE_BACKEND env var: local | s3 | db
"""
import os
import uuid
import aiofiles
from pathlib import Path
from typing import Optional

from core.config import settings


class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        if self.backend == "local":
            self.base_path = Path(settings.LOCAL_STORAGE_PATH)
            self.base_path.mkdir(parents=True, exist_ok=True)
        elif self.backend == "s3":
            import boto3
            self.s3 = boto3.client(
                "s3",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
            self.bucket = settings.AWS_S3_BUCKET

    async def upload(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Upload file and return storage key."""
        ext = Path(filename).suffix
        key = f"books/{uuid.uuid4()}{ext}"

        if self.backend == "db":
            # For DB backend: caller must persist file_bytes to Book.file_data.
            # We return a placeholder key; actual bytes stored via save_to_book().
            return f"db:{key}"

        elif self.backend == "local":
            file_path = self.base_path / key
            file_path.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(file_bytes)

        elif self.backend == "s3":
            import asyncio
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.s3.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=file_bytes,
                    ContentType=content_type,
                ),
            )
        return key

    async def download(self, key: str, book_id: Optional[str] = None) -> bytes:
        """Download file bytes by key."""
        if self.backend == "db" or (key and key.startswith("db:")):
            # Fetch raw bytes from Postgres
            if not book_id:
                raise ValueError("book_id required for DB storage backend")
            from core.database import AsyncSessionLocal
            from models.db import Book
            from sqlalchemy import select
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(Book).where(Book.id == book_id))
                book = result.scalar_one_or_none()
                if not book or not book.file_data:
                    raise FileNotFoundError(f"No file_data in DB for book {book_id}")
                return book.file_data

        elif self.backend == "local":
            file_path = self.base_path / key
            async with aiofiles.open(file_path, "rb") as f:
                return await f.read()

        elif self.backend == "s3":
            import asyncio
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.s3.get_object(Bucket=self.bucket, Key=key),
            )
            return response["Body"].read()

    def get_url(self, key: str, expires: int = 3600) -> str:
        """Get a temporary public URL for the file."""
        if self.backend == "db" or (key and key.startswith("db:")):
            return None   # No direct file URL for DB-stored books
        elif self.backend == "local":
            return f"/static/{key}"
        elif self.backend == "s3":
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires,
            )

    async def delete(self, key: str, book_id: Optional[str] = None):
        """Delete a file from storage."""
        if self.backend == "db" or (key and key.startswith("db:")):
            # File bytes are stored in Book.file_data — deleted via CASCADE on Book deletion
            return

        elif self.backend == "local":
            file_path = self.base_path / key
            if file_path.exists():
                file_path.unlink()

        elif self.backend == "s3":
            import asyncio
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.s3.delete_object(Bucket=self.bucket, Key=key),
            )
