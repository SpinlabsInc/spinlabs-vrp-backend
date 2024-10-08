import os
import json
import boto3
from flask import Flask, jsonify, request
from flask_cors import CORS
from botocore.exceptions import ClientError
from src.vrp_solver import solve_vrp


app = Flask(__name__)
CORS(app)


# Get environment variables
ENVIRONMENT = os.getenv('ENVIRONMENT', 'develop')

# Initialize AWS clients with environment-specific configurations
session = boto3.Session()
dynamodb = session.resource('dynamodb')
s3 = session.client('s3')
batch = session.client('batch')

# Define environment-specific resource names
VRP_DATA_TABLE = os.getenv('VRP_DATA_TABLE')
VRP_SOLUTIONS_BUCKET = os.getenv('VRP_SOLUTIONS_BUCKET')
VRP_SOLVER_JOB_DEFINITION = os.getenv('VRP_SOLVER_JOB_DEFINITION')
VRP_SOLVER_JOB_QUEUE = os.getenv('VRP_SOLVER_JOB_QUEUE')

table = dynamodb.Table(VRP_DATA_TABLE)

@app.route('/api/vrp-solution', methods=['GET', 'POST', 'PUT', 'DELETE'])
def vrp_solution():
    try:
        if request.method == 'GET':
            result = solve_vrp(dynamodb, VRP_DATA_TABLE)
            return jsonify(result), 202

        elif request.method == 'POST':
            data = request.json
            table.put_item(Item={
                'id': 'current_data',
                'data': data
            })
            return jsonify({'message': 'Data added successfully'}), 201

        elif request.method == 'PUT':
            data = request.json
            table.update_item(
                Key={'id': 'current_data'},
                UpdateExpression='SET data = :val',
                ExpressionAttributeValues={':val': data}
            )
            return jsonify({'message': 'Data updated successfully'}), 200

        elif request.method == 'DELETE':
            table.delete_item(Key={'id': 'current_data'})
            return jsonify({'message': 'Data deleted successfully'}), 200

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
    app.run(host='0.0.0.0', port=80)