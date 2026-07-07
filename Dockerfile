FROM python:3.11

WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and mock data
COPY backend/ ./backend/
COPY mock_data/ ./mock_data/

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Command to run the FastAPI server
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
