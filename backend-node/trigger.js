const prompt = `Scenario 1: Homepage and navigation validation
1. Open the website at https://novalantis.com/
2. Verify homepage loads successfully.
3. Verify the "Explore Products" link is visible.
4. Verify the "Book a Demo" link is visible.
5. Verify the top navigation menu is displayed.

Scenario 2: Products page validation
1. Click the "Products" link in the navigation menu.
2. Verify the products page loads successfully.
3. Verify the product details are visible.

Scenario 3: Contact Us flow validation
1. Click the "Contact Us" link in the navigation menu.
2. Verify the contact form is visible.
3. Verify the Name, Email, and Phone input fields are visible.
4. Verify the Submit button is visible.

Scenario 4: Contact form valid submission
1. Fill in the Name input with Shivam Kumar.
2. Fill in the Email input with shivam.kumar@gmail.com.
3. Fill in the Phone input with +91 9876543210.
4. Fill in the Company input with Novalantis.
5. Fill in the Message input with Interested in AI QA demo.
6. Click the Submit button.
7. Verify the success message appears.

Scenario 5: Company About Us validation
1. Navigate back to the homepage.
2. Click the "Company" dropdown in the navigation menu.
3. Click the "About Us" link.
4. Verify the About Us page loads successfully.`;

fetch('http://localhost:8080/api/v1/autonomous/run', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        targetUrl: 'https://novalantis.com/',
        customScenario: prompt,
        browsers: ['chromium'],
        features: {}
    })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
