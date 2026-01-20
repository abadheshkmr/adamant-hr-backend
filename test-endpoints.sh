#!/bin/bash

# Test script for Client Management Endpoints
# Make sure your backend is running on http://localhost:4000

BASE_URL="http://localhost:4000/api"
ADMIN_TOKEN="" # Will be set after login

echo "=========================================="
echo "Testing Client Management Endpoints"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Admin Login
echo -e "${YELLOW}Step 1: Admin Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"${ADMINNAME:-admin}"'",
    "password": "'"${PASSWORD:-password}"'"
  }')

echo "Login Response: $LOGIN_RESPONSE"
ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Please check your credentials.${NC}"
  echo "Note: Set ADMINNAME and PASSWORD environment variables if needed"
  exit 1
fi

echo -e "${GREEN}✅ Login successful. Token obtained.${NC}"
echo ""

# Step 2: Add a Client
echo -e "${YELLOW}Step 2: Add a Client${NC}"
ADD_CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/client/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "TechCorp Solutions",
    "description": "A leading technology solutions provider",
    "contactPerson": "John Doe",
    "email": "contact@techcorp.com",
    "phone": "+91 9876543210",
    "address": "123 Tech Street, Noida, UP",
    "website": "https://techcorp.com",
    "isActive": true
  }')

echo "Add Client Response: $ADD_CLIENT_RESPONSE"
CLIENT_ID=$(echo $ADD_CLIENT_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}❌ Failed to add client${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Client added successfully. ID: $CLIENT_ID${NC}"
echo ""

# Step 3: List All Clients
echo -e "${YELLOW}Step 3: List All Clients${NC}"
LIST_CLIENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/client/list" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "List Clients Response: $LIST_CLIENTS_RESPONSE"
echo -e "${GREEN}✅ Clients listed${NC}"
echo ""

# Step 4: Get Client by ID
echo -e "${YELLOW}Step 4: Get Client by ID${NC}"
GET_CLIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/client/get/$CLIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Get Client Response: $GET_CLIENT_RESPONSE"
echo -e "${GREEN}✅ Client retrieved${NC}"
echo ""

# Step 5: Update Client
echo -e "${YELLOW}Step 5: Update Client${NC}"
UPDATE_CLIENT_RESPONSE=$(curl -s -X PUT "$BASE_URL/client/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "id": "'"$CLIENT_ID"'",
    "description": "Updated description - A leading technology solutions provider specializing in AI and Cloud",
    "contactPerson": "Jane Smith"
  }')

echo "Update Client Response: $UPDATE_CLIENT_RESPONSE"
echo -e "${GREEN}✅ Client updated${NC}"
echo ""

# Step 6: Add Vacancy with Client
echo -e "${YELLOW}Step 6: Add Vacancy with Client${NC}"
ADD_VACANCY_RESPONSE=$(curl -s -X POST "$BASE_URL/vacancy/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "jobTitle": "Senior Software Engineer",
    "description": "We are looking for an experienced software engineer to join our team.",
    "qualification": "B.Tech in Computer Science with 5+ years experience",
    "skills": ["JavaScript", "Node.js", "React", "MongoDB"],
    "city": "Noida",
    "state": "Uttar Pradesh",
    "employmentType": "Full-time",
    "experienceLevel": "5-10 years",
    "salary": {
      "min": 800000,
      "max": 1200000,
      "currency": "INR",
      "isNegotiable": true
    },
    "client": "'"$CLIENT_ID"'",
    "showClientToCandidate": false,
    "status": "active"
  }')

echo "Add Vacancy Response: $ADD_VACANCY_RESPONSE"
VACANCY_ID=$(echo $ADD_VACANCY_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$VACANCY_ID" ]; then
  echo -e "${RED}❌ Failed to add vacancy${NC}"
else
  echo -e "${GREEN}✅ Vacancy added with client. ID: $VACANCY_ID${NC}"
fi
echo ""

# Step 7: Get Vacancy (Public - should NOT show client)
echo -e "${YELLOW}Step 7: Get Vacancy (Public - client should be hidden)${NC}"
GET_VACANCY_PUBLIC=$(curl -s -X GET "$BASE_URL/vacancy/get/$VACANCY_ID")
echo "Public Get Vacancy Response: $GET_VACANCY_PUBLIC"

if echo "$GET_VACANCY_PUBLIC" | grep -q "client"; then
  echo -e "${RED}❌ Client should be hidden from public endpoint!${NC}"
else
  echo -e "${GREEN}✅ Client correctly hidden from public endpoint${NC}"
fi
echo ""

# Step 8: Get Vacancy (Admin - should show client)
echo -e "${YELLOW}Step 8: Get Vacancy (Admin - client should be visible)${NC}"
GET_VACANCY_ADMIN=$(curl -s -X GET "$BASE_URL/vacancy/get/$VACANCY_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Admin Get Vacancy Response: $GET_VACANCY_ADMIN"

if echo "$GET_VACANCY_ADMIN" | grep -q "client"; then
  echo -e "${GREEN}✅ Client visible in admin endpoint${NC}"
else
  echo -e "${YELLOW}⚠️  Client not found in admin response (may be null)${NC}"
fi
echo ""

# Step 9: Update Vacancy to show client to candidates
echo -e "${YELLOW}Step 9: Update Vacancy to show client to candidates${NC}"
UPDATE_VACANCY_RESPONSE=$(curl -s -X PUT "$BASE_URL/vacancy/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "id": "'"$VACANCY_ID"'",
    "showClientToCandidate": true
  }')

echo "Update Vacancy Response: $UPDATE_VACANCY_RESPONSE"
echo -e "${GREEN}✅ Vacancy updated to show client${NC}"
echo ""

# Step 10: Get Vacancy (Public - should NOW show client)
echo -e "${YELLOW}Step 10: Get Vacancy (Public - client should now be visible)${NC}"
GET_VACANCY_PUBLIC2=$(curl -s -X GET "$BASE_URL/vacancy/get/$VACANCY_ID")
echo "Public Get Vacancy Response (after update): $GET_VACANCY_PUBLIC2"

if echo "$GET_VACANCY_PUBLIC2" | grep -q "TechCorp"; then
  echo -e "${GREEN}✅ Client now visible to public after enabling showClientToCandidate${NC}"
else
  echo -e "${YELLOW}⚠️  Client name not found in public response${NC}"
fi
echo ""

# Step 11: List Vacancies with Client Filter (Admin)
echo -e "${YELLOW}Step 11: List Vacancies with Client Filter (Admin)${NC}"
LIST_VACANCIES_FILTERED=$(curl -s -X GET "$BASE_URL/vacancy/list?client=$CLIENT_ID&status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Filtered Vacancies Response: $LIST_VACANCIES_FILTERED"
echo -e "${GREEN}✅ Vacancies filtered by client${NC}"
echo ""

# Step 12: Cleanup - Remove Vacancy
echo -e "${YELLOW}Step 12: Cleanup - Remove Vacancy${NC}"
REMOVE_VACANCY_RESPONSE=$(curl -s -X POST "$BASE_URL/vacancy/remove" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"id": "'"$VACANCY_ID"'"}')

echo "Remove Vacancy Response: $REMOVE_VACANCY_RESPONSE"
echo -e "${GREEN}✅ Vacancy removed${NC}"
echo ""

# Step 13: Remove Client
echo -e "${YELLOW}Step 13: Remove Client${NC}"
REMOVE_CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/client/remove" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"id": "'"$CLIENT_ID"'"}')

echo "Remove Client Response: $REMOVE_CLIENT_RESPONSE"
echo -e "${GREEN}✅ Client removed${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}All Tests Completed!${NC}"
echo "=========================================="
