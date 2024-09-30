FROM python:3.9-slim-buster
WORKDIR /app

# Copy the requirements file from the correct directory
COPY requirements.txt /app/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the remaining application code
COPY . /app

# Command to run the app
CMD ["gunicorn", "-b", "0.0.0.0:80", "main:app"]
