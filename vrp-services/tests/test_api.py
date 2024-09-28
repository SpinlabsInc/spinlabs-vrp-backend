import unittest
import json
from src.main import app

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    def test_health_check(self):
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')

    def test_get_vrp_solution(self):
        response = self.app.get('/vrp-solution')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('routes', data)
        self.assertIn('total_time', data)
        self.assertIn('objective_value', data)

    def test_post_new_location(self):
        new_location = {
            'location': (17.9850, 79.5350),
            'time_window': (600, 900),
            'service_time': 25
        }
        response = self.app.post('/vrp-solution', json=new_location)
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Data added successfully')

    def test_update_location(self):
        update_data = {
            'index': 0,
            'location': (17.9800, 79.6000),
            'time_window': (550, 1270),
            'service_time': 10
        }
        response = self.app.put('/vrp-solution', json=update_data)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Data updated successfully')

    def test_delete_location(self):
        delete_data = {'index': 0}
        response = self.app.delete('/vrp-solution', json=delete_data)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Data deleted successfully')

if __name__ == '__main__':
    unittest.main()
