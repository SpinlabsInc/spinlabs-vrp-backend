import os
import json
import boto3
from flask import Flask, jsonify, request
from flask_cors import CORS
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
batch = boto3.client('batch')

# Get environment variables
ENVIRONMENT = os.getenv('ENVIRONMENT', 'develop')
VRP_DATA_TABLE = os.getenv('VRP_DATA_TABLE', f'vrp-data-table-{ENVIRONMENT}')
VRP_SOLUTIONS_BUCKET = os.getenv('VRP_SOLUTIONS_BUCKET', f'vrp-solutions-bucket-{ENVIRONMENT}')
VRP_SOLVER_JOB_DEFINITION = os.getenv('VRP_SOLVER_JOB_DEFINITION', f'vrp-solver-job-definition-{ENVIRONMENT}')
VRP_SOLVER_JOB_QUEUE = os.getenv('VRP_SOLVER_JOB_QUEUE', f'vrp-solver-job-queue-{ENVIRONMENT}')


table = dynamodb.Table(VRP_DATA_TABLE)

@app.route('/api/vrp-solution', methods=['GET', 'POST', 'PUT', 'DELETE'])
def vrp_solution():
    try:
        if request.method == 'GET':
            # Retrieve VRP data from DynamoDB
            response = table.get_item(Key={'id': 'current_data'})
            vrp_data = response['Item']['data']

            # Submit AWS Batch job
            job_response = batch.submit_job(
                jobName='vrp-solver-job',
                jobQueue=VRP_SOLVER_JOB_QUEUE,
                jobDefinition=VRP_SOLVER_JOB_DEFINITION,
                containerOverrides={
                    'environment': [
                        {
                            'name': 'VRP_DATA',
                            'value': json.dumps(vrp_data)
                        }
                    ]
                }
            )

            return jsonify({'jobId': job_response['jobId']}), 202

        elif request.method == 'POST':
            data = request.json
            # Store new VRP data in DynamoDB
            table.put_item(Item={
                'id': 'current_data',
                'data': data
            })
            return jsonify({'message': 'Data added successfully'}), 201

        elif request.method == 'PUT':
            data = request.json
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