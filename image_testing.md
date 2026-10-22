# Image testing rules for Gemini image detection

- Accepted MIME types: image/jpeg, image/png, image/webp only. Transcode SVG/BMP/HEIC first.
- For animated images (GIF/APNG/animated WEBP), extract frame 1 only.
- Resize before encoding — avoid multi-MB base64 payloads (target under 2 MB).
- Do not send blank or solid-colour images.
- The /api/detect endpoint accepts image_base64 as either a raw base64 string or a data URL (data:image/jpeg;base64,...).
