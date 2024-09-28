import unittest
from src import vrp_solver
from src import vrp_data

class TestVRPSolver(unittest.TestCase):
    def test_create_data_model(self):
        data = vrp_solver.create_data_model()
        self.assertEqual(len(data['locations']), 5)
        self.assertEqual(len(data['time_windows']), 5)
        self.assertEqual(len(data['service_times']), 5)
        self.assertEqual(len(data['distance_matrix']), 5)
        self.assertEqual(data['num_vehicles'], 4)
        self.assertEqual(data['depot'], 0)

    def test_solve_vrp(self):
        solution = vrp_solver.solve_vrp()
        self.assertIsNotNone(solution)
        self.assertIn('routes', solution)
        self.assertIn('total_time', solution)
        self.assertIn('objective_value', solution)
        self.assertEqual(len(solution['routes']), 4)  # Number of vehicles

if __name__ == '__main__':
    unittest.main()
