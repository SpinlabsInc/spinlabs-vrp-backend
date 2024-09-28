import os
import json
from moto import mock_dynamodb, mock_s3, mock_batch
import boto3
from main import app
import unittest

class TestVRPBackend(unittest.TestCase):
    @mock_dynamodb
    @mock_s3
    @mock_batch
    def setUp(self):
        # Set up mock DynamoDB
        self.dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        self.table = self.dynamodb.create_table(
            TableName='vrp_data',
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
        )

        # Set up mock S3
        self.s3 = boto3.client('s3', region_name='us-east-1')
        self.s3.create_bucket(Bucket='vrp-solutions')

        # Set up mock Batch
        self.batch = boto3.client('batch', region_name='us-east-1')
        self.batch.create_compute_environment(
            computeEnvironmentName='test_compute_env',
            type='MANAGED',
            state='ENABLED',
            computeResources={
                'type': 'EC2',
                'minvCpus': 0,
                'maxvCpus': 2,
                'desiredvCpus': 0,
                'instanceTypes': ['optimal'],
                'subnets': ['subnet-12345678'],
                'securityGroupIds': ['sg-12345678'],
                'instanceRole': 'ecsInstanceRole',
            },
            serviceRole='AWSBatchServiceRole'
        )

        # Set environment variables
        os.environ['VRP_DATA_TABLE'] = 'vrp_data'
        os.environ['VRP_SOLUTIONS_BUCKET'] = 'vrp-solutions'
        os.environ['VRP_SOLVER_JOB_DEFINITION'] = 'test-job-definition'
        os.environ['VRP_SOLVER_JOB_QUEUE'] = 'test-job-queue'

        self.app = app.test_client()

    def test_health_check(self):
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {'status': 'healthy'})

    def test_post_vrp_data(self):
        test_data = {
            'locations': [(0, 0), (1, 1)],
            'time_windows': [(0, 100), (50, 150)],
            'service_times': [10, 20],
            'num_vehicles': 1
        }
        response = self.app.post('/api/vrp-solution', json=test_data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json, {'message': 'Data added successfully'})

    def test_get_vrp_solution(self):
        # First, add some test data
        test_data = {
            'locations': [(0, 0), (1, 1)],
            'time_windows': [(0, 100), (50, 150)],
            'service_times': [10, 20],
            'num_vehicles': 1
        }
        self.app.post('/api/vrp-solution', json=test_data)

        # Now, try to get a solution
        response = self.app.get('/api/vrp-solution')
        self.assertEqual(response.status_code, 202)
        self.assertIn('jobId', response.json)

    # Add more tests as needed

if __name__ == '__main__':
    unittest.main()