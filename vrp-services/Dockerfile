# Use an official Python runtime as a parent image
FROM python:3.9-slim-buster

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code into the container
COPY src/ /app/src/

# Set the PYTHONPATH to include the src directory
ENV PYTHONPATH="/app/src"

# Set the default AWS region
ENV AWS_DEFAULT_REGION us-east-1

# Expose port 80 for Flask app
EXPOSE 80

# Command will be provided by docker-compose.yml
