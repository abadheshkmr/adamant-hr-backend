# Quick Testing Guide for Client Management

## Prerequisites
- Backend running on `http://localhost:4000`
- Admin credentials configured in `.env` file

## Step 1: Get Admin Token

```bash
curl -X POST http://localhost:4000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "id": "your_admin_username",
    "password": "your_admin_password"
  }'
```

**Save the token from the response** (you'll need it for all client endpoints)

## Step 2: Create a Client

```bash
curl -X POST http://localhost:4000/api/client/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "TechCorp Solutions",
    "description": "A leading technology solutions provider",
    "contactPerson": "John Doe",
    "email": "contact@techcorp.com",
    "phone": "+91 9876543210",
    "address": "123 Tech Street, Noida, UP",
    "website": "https://techcorp.com",
    "isActive": true
  }'
```

**Save the `_id` from the response** (you'll need it for vacancy creation)

## Step 3: List All Clients

```bash
curl -X GET http://localhost:4000/api/client/list \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Step 4: Create Vacancy with Client (Hidden from Candidates)

```bash
curl -X POST http://localhost:4000/api/vacancy/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "jobTitle": "Senior Software Engineer",
    "description": "We are looking for an experienced software engineer.",
    "qualification": "B.Tech in Computer Science with 5+ years experience",
    "skills": ["JavaScript", "Node.js", "React"],
    "city": "Noida",
    "state": "Uttar Pradesh",
    "employmentType": "Full-time",
    "experienceLevel": "5-10 years",
    "salary": {
      "min": 800000,
      "max": 1200000,
      "currency": "INR"
    },
    "client": "CLIENT_ID_FROM_STEP_2",
    "showClientToCandidate": false,
    "status": "active"
  }'
```

**Save the `_id` from the response**

## Step 5: Test Public Endpoint (Client Should Be Hidden)

```bash
# Get vacancy as public user (no token)
curl -X GET http://localhost:4000/api/vacancy/get/VACANCY_ID_FROM_STEP_4
```

**Expected:** Response should NOT contain `client` field

## Step 6: Test Admin Endpoint (Client Should Be Visible)

```bash
# Get vacancy as admin (with token)
curl -X GET http://localhost:4000/api/vacancy/get/VACANCY_ID_FROM_STEP_4 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** Response SHOULD contain `client` field with client details

## Step 7: Update Vacancy to Show Client to Candidates

```bash
curl -X PUT http://localhost:4000/api/vacancy/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "id": "VACANCY_ID_FROM_STEP_4",
    "showClientToCandidate": true
  }'
```

## Step 8: Test Public Endpoint Again (Client Should Now Be Visible)

```bash
# Get vacancy as public user (no token)
curl -X GET http://localhost:4000/api/vacancy/get/VACANCY_ID_FROM_STEP_4
```

**Expected:** Response SHOULD NOW contain `client` field with client name

## Step 9: Filter Vacancies by Client (Admin Only)

```bash
curl -X GET "http://localhost:4000/api/vacancy/list?client=CLIENT_ID_FROM_STEP_2&status=active" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** Only vacancies for that client should be returned

## Step 10: Update Client

```bash
curl -X PUT http://localhost:4000/api/client/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "id": "CLIENT_ID_FROM_STEP_2",
    "description": "Updated description",
    "contactPerson": "Jane Smith"
  }'
```

## Step 11: Get Client Details

```bash
curl -X GET http://localhost:4000/api/client/get/CLIENT_ID_FROM_STEP_2 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** Client details with vacancy count

## Step 12: Cleanup (Optional)

```bash
# Remove vacancy first
curl -X POST http://localhost:4000/api/vacancy/remove \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"id": "VACANCY_ID_FROM_STEP_4"}'

# Then remove client
curl -X POST http://localhost:4000/api/client/remove \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"id": "CLIENT_ID_FROM_STEP_2"}'
```

## Testing Checklist

- [ ] Admin login works
- [ ] Create client works
- [ ] List clients works
- [ ] Create vacancy with client (hidden) works
- [ ] Public endpoint hides client when `showClientToCandidate: false`
- [ ] Admin endpoint shows client
- [ ] Update vacancy to show client works
- [ ] Public endpoint shows client when `showClientToCandidate: true`
- [ ] Filter vacancies by client works
- [ ] Update client works
- [ ] Get client details works
- [ ] Cannot delete client with associated vacancies
- [ ] Can delete client after removing vacancies

## Common Issues

1. **401 Unauthorized**: Make sure you're using the correct token and Bearer format
2. **404 Not Found**: Check that IDs are correct (MongoDB ObjectIds)
3. **400 Bad Request**: Check JSON format and required fields
4. **Client not showing**: Verify `showClientToCandidate` is set to `true`
