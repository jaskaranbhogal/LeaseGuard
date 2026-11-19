"""Bound bytes while streaming, before a malicious upload fills temporary disk."""
from django.core.files.uploadhandler import FileUploadHandler, StopUpload
from inspections.media import MAX_BYTES


class BoundedImageUploadHandler(FileUploadHandler):
    def new_file(self, *args, **kwargs):
        super().new_file(*args, **kwargs)
        self.received = 0

    def receive_data_chunk(self, raw_data, start):
        self.received += len(raw_data)
        if self.received > MAX_BYTES:
            self.request.upload_limit_exceeded = True
            raise StopUpload(connection_reset=True)
        return raw_data

    def file_complete(self, file_size):
        return None
