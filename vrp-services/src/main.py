import os
import json
from decimal import Decimal  # Import Decimal to handle float conversions
import boto3
from flask import Flask, jsonify, request
from flask_cors import CORS
from botocore.exceptions import ClientError
from unittest.mock import MagicMock  # To mock batch service
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Check if running in local mode
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', 'False').lower() == 'true'

# Initialize AWS clients
if USE_LOCAL_DB:
    dynamodb = boto3.resource('dynamodb', endpoint_url='http://localhost:4566')
    s3 = boto3.client('s3', endpoint_url='http://localhost:4566')
else:
    dynamodb = boto3.resource('dynamodb')
    s3 = boto3.client('s3')
    batch = boto3.client('batch')

# Get environment variables
VRP_DATA_TABLE = os.environ['VRP_DATA_TABLE']
VRP_SOLUTIONS_BUCKET = os.environ['VRP_SOLUTIONS_BUCKET']
VRP_SOLVER_JOB_DEFINITION = os.environ['VRP_SOLVER_JOB_DEFINITION']
VRP_SOLVER_JOB_QUEUE = os.environ['VRP_SOLVER_JOB_QUEUE']

table = dynamodb.Table(VRP_DATA_TABLE)

@app.route('/api/vrp-solution', methods=['GET', 'POST', 'PUT', 'DELETE'])
def vrp_solution():
    try:
        if request.method == 'GET':
            # Retrieve VRP data from DynamoDB
            response = table.get_item(Key={'id': 'current_data'})
            vrp_data = response['Item']['data']

            # Submit AWS Batch job
            if USE_LOCAL_DB:
                job_response = batch.submit_job(  # This will use the mocked job submission
                    jobName='vrp-solver-job',
                    jobQueue=VRP_SOLVER_JOB_QUEUE,
                    jobDefinition=VRP_SOLVER_JOB_DEFINITION,
                    containerOverrides={
                        'environment': [
                            {
                                'name': 'VRP_DATA',
                                'value': json.dumps(vrp_data, default=str)
                            }
                        ]
                    }
                )
            else:
                job_response = batch.submit_job(
                    jobName='vrp-solver-job',
                    jobQueue=VRP_SOLVER_JOB_QUEUE,
                    jobDefinition=VRP_SOLVER_JOB_DEFINITION,
                    containerOverrides={
                        'environment': [
                            {
                                'name': 'VRP_DATA',
                                'value': json.dumps(vrp_data, default=str)
                            }
                        ]
                    }
                )

            return jsonify({'jobId': job_response['jobId']}), 202

        elif request.method == 'POST':
            data = request.json

            # Convert float values in locations to Decimal
            for i, location in enumerate(data['locations']):
                data['locations'][i] = [Decimal(str(coord)) for coord in location]

            # Convert other float values to Decimal
            data['service_times'] = [Decimal(str(time)) for time in data['service_times']]
            data['num_vehicles'] = int(data['num_vehicles'])  # Ensure this is an integer

            # Store new VRP data in DynamoDB
            table.put_item(Item={
                'id': 'current_data',
                'data': data
            })
            return jsonify({'message': 'Data added successfully'}), 201

        elif request.method == 'PUT':
            data = request.json

            # Convert float values in locations to Decimal
            for i, location in enumerate(data['locations']):
                data['locations'][i] = [Decimal(str(coord)) for coord in location]

            # Convert other float values to Decimal
            data['service_times'] = [Decimal(str(time)) for time in data['service_times']]
            data['num_vehicles'] = int(data['num_vehicles'])  # Ensure this is an integer

            # Update VRP data in DynamoDB
            table.update_item(
                Key={'id': 'current_data'},
                UpdateExpression='SET data = :val',
                ExpressionAttributeValues={':val': data}
            )
            return jsonify({'message': 'Data updated successfully'}), 200

        elif request.method == 'DELETE':
            # Delete VRP data from DynamoDB
            table.delete_item(Key={'id': 'current_data'})
            return jsonify({'message': 'Data deleted successfully'}), 200

    except ClientError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/vrp-data', methods=['GET'])
def get_vrp_data():
    try:
        # Scan the DynamoDB table to retrieve all items
        response = table.scan()
        
        # Retrieve the items from the response
        items = response.get('Items', [])
        
        return jsonify(items), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/job-status/<job_id>', methods=['GET'])
def job_status(job_id):
    try:
        response = batch.describe_jobs(jobs=[job_id])
        job = response['jobs'][0]
        return jsonify({
            'jobId': job['jobId'],
            'status': job['status'],
            'createdAt': job['createdAt'].isoformat(),
            'startedAt': job['startedAt'].isoformat() if 'startedAt' in job else None,
            'stoppedAt': job['stoppedAt'].isoformat() if 'stoppedAt' in job else None,
        }), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/job-result/<job_id>', methods=['GET'])
def job_result(job_id):
    try:
        response = s3.get_object(Bucket=VRP_SOLUTIONS_BUCKET, Key=f"solution_{job_id}.json")
        solution = json.loads(response['Body'].read().decode('utf-8'))
        return jsonify(solution), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, debug=True)
