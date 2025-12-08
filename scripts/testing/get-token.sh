#!/bin/bash
curl -s -X POST http://localhost:6100/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo.user@orchestratorai.io","password":"DemoUser123!"}' | jq -r '.access_token'
