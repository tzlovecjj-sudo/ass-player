#!/usr/bin/env python3
"""Tests for /api/report-cdn endpoint"""
import unittest
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app import app
except Exception:
    app = None


class TestReportCdn(unittest.TestCase):
    def setUp(self):
        if app is None:
            self.skipTest('app not available')
        self.client = app.test_client()

    @patch('app.app')
    def test_missing_payload(self, mock_app):
        resp = self.client.post('/api/report-cdn', json={})
        self.assertEqual(resp.status_code, 400)

    @patch('app.app')
    def test_valid_report(self, mock_app):
        # mock parser methods
        mock_parser = type('P', (), {'mark_cdn_hostname': lambda *a, **k: None, 'record_cdn_load': lambda *a, **k: None})()
        mock_app._parser = mock_parser
        resp = self.client.post('/api/report-cdn', json={'hostname': 'example.com', 'load_ms': 123})
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data.get('success'))


if __name__ == '__main__':
    unittest.main()
