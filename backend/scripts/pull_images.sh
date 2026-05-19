#!/bin/bash
set -e

echo "Pulling Docker images for code execution..."

echo "Pulling python:3.11-alpine..."
docker pull python:3.11-alpine

echo "Pulling node:18-alpine..."
docker pull node:18-alpine

echo "Pulling gcc:13..."
docker pull gcc:13

echo "All images pulled successfully!"
