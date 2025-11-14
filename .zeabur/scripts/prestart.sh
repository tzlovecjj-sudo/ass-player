#!/bin/bash
# Zeabur prestart script
# Only run tests when the environment variable RUN_TESTS is explicitly set to "1".
# This prevents tests from running during normal Zeabur deployments unless you opt in.

if [ "${RUN_TESTS:-0}" = "1" ]; then
	echo "RUN_TESTS=1 -> running tests"
	python run_tests.py
else
	echo "Skipping tests (RUN_TESTS not set or not equal to 1)"
fi
