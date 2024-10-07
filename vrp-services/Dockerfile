# Use an official Python runtime as a parent image
FROM python:3.9-slim-buster

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code into the container
COPY src/ /app/src/

# Pass environment-specific variables
ARG ENVIRONMENT
ENV ENVIRONMENT=$ENVIRONMENT
ENV AWS_DEFAULT_REGION us-east-1

# Expose port 80
EXPOSE 80

# Define the Gunicorn command to run the app
CMD ["gunicorn", "-b", "0.0.0.0:80", "src.main:app"]
