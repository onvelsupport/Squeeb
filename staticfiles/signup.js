document.addEventListener('DOMContentLoaded', () => {

    // toggle password visibility
    const pwToggle = document.getElementById('pwToggle');
    const pwInput = document.getElementById('password');

    pwToggle.addEventListener('click', () => {
        const isPw = pwInput.type === "password";
        pwInput.type = isPw ? "text" : "password";
        pwToggle.innerHTML = isPw 
            ? '<i class="fa fa-eye-slash"></i>' 
            : '<i class="fa fa-eye"></i>';
    });

    const pwToggle2 = document.getElementById('pwToggle2');
    const pwInput2 = document.getElementById('confirmPassword');

    pwToggle2.addEventListener('click', () => {
        const isPw = pwInput2.type === "password";
        pwInput2.type = isPw ? "text" : "password";
        pwToggle2.innerHTML = isPw 
            ? '<i class="fa fa-eye-slash"></i>' 
            : '<i class="fa fa-eye"></i>';
    });

    // form submit
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const referral = document.getElementById('referral').value.trim();

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            const response = await fetch("/api/signup/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    referral
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert("Account created successfully!");
                window.location.href = "/login/";   
            } else {
                alert(data.error || "Signup failed");
            }

        } catch (err) {
            alert("Server error, try again.");
            console.error(err);
        }
    });

});
