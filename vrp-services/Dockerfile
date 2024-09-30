# Use an official Python runtime as a parent image
FROM python:3.9-slim-buster

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install any dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container
COPY . /app

# Expose port 80
EXPOSE 80

# Define the Gunicorn command to run the app
CMD ["gunicorn", "-b", "0.0.0.0:80", "main:app"]
