import os
import boto3
from flask import Flask, jsonify
from vrp_solver import solve_vrp
import logging

# Setup logging with INFO level
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize DynamoDB client
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', 'False').lower() == 'true'
LOCALSTACK_ENDPOINT = os.environ.get('LOCALSTACK_ENDPOINT', 'http://localhost:4566')

if USE_LOCAL_DB:
    dynamodb = boto3.resource('dynamodb', endpoint_url=LOCALSTACK_ENDPOINT, aws_access_key_id='dummy', aws_secret_access_key='dummy')
else:
    dynamodb = boto3.resource('dynamodb')

# Define the DynamoDB table name from environment variable
VRP_DATA_TABLE = os.environ['VRP_DATA_TABLE']

@app.route('/api/solve_vrp', methods=['GET'])
def solve_and_store_vrp_solution():
    try:
        result = solve_vrp(dynamodb, VRP_DATA_TABLE)
        if result:
            logger.info("VRP solution successfully solved, stored, and notified.")
            return jsonify(result)  # Send the result containing status and file name
        else:
            logger.error("No solution found for VRP problem.")
            return jsonify({'status': 'error', 'message': 'No solution found'}), 400
    except Exception as e:
        app.logger.error(f"Exception on /api/solve_vrp: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
