# Resmi Python imajını kullanıyoruz
FROM python:3.11-slim

# Çalışma dizinini ayarlıyoruz
WORKDIR /app

# Bağımlılık listesini kopyalayıp kuruyoruz
COPY requirements.txt .
# Önce çekirdek paketleyicileri güvenli sürümlere yükseltiyoruz
RUN pip install --no-cache-dir --upgrade pip>=26.1.2 setuptools>=83.0.0 wheel>=0.46.2

# Sonra kendi projemizin gereksinimlerini kuruyoruz
RUN pip install --no-cache-dir -r requirements.txt

# Tüm kodları kopyalıyoruz
COPY . .

# FastAPI'nin çalışacağı portu dışa açıyoruz
EXPOSE 8000

# Uygulamayı başlatma komutu
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

