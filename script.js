document.addEventListener('DOMContentLoaded', function() {
    const agentSelection = document.getElementById('agentSelection');
    const targetURLInput = document.getElementById('targetURL');
    const targetURLLabel = document.querySelector('label[for="targetURL"]');

    // Function to update form based on agent selection
    function updateFormForAgent() {
        const selectedAgent = agentSelection.value;

        // Reset to defaults or common fields first
        targetURLLabel.textContent = 'Target URL:';
        targetURLInput.placeholder = 'e.g., Jenkins URL, Harness Delegator URL, or script execution endpoint';

        // Example: Customize Target URL based on agent
        if (selectedAgent === 'harness') {
            targetURLLabel.textContent = 'Harness Delegator URL:';
            targetURLInput.placeholder = 'Enter Harness Delegator specific URL';
            // Potentially show/hide other fields specific to Harness
            // document.getElementById('harnessSpecificFieldContainer').style.display = 'block';
            // document.getElementById('temporalSpecificFieldContainer').style.display = 'none';
        } else if (selectedAgent === 'temporal') {
            targetURLLabel.textContent = 'Temporal Agent Endpoint:';
            targetURLInput.placeholder = 'Enter Temporal workflow trigger endpoint';
            // Potentially show/hide other fields specific to Temporal
            // document.getElementById('harnessSpecificFieldContainer').style.display = 'none';
            // document.getElementById('temporalSpecificFieldContainer').style.display = 'block';
        } else if (selectedAgent === 'default') {
            targetURLLabel.textContent = 'Script Execution Endpoint:';
            targetURLInput.placeholder = 'Enter script execution endpoint';
            // Reset or show/hide fields for default
        }
        // Add more logic here to show/hide or change other fields based on agent selection
    }

    // Initial call to set up form based on default selection
    updateFormForAgent();

    // Add event listener for changes
    agentSelection.addEventListener('change', updateFormForAgent);

    // Form submission handling
    const form = document.getElementById('onboardingForm');
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent actual submission

        if (!validateForm()) {
            alert('Please fill in all required fields correctly.');
            return;
        }

        console.log('Form validation successful. Proceeding to data collection.');
        const formData = collectFormData(form);
        saveConfiguration(formData); // Step 5

        // For now, GitHub mapping generation and confirmation are placeholders
        generateGitHubMappingFile(formData); // Step 6 (placeholder)
        showConfirmation(formData); // Step 7 (placeholder)
    });

    function collectFormData(formElement) {
        const data = new FormData(formElement);
        const formDataObject = {};

        data.forEach((value, key) => {
            if (formDataObject[key]) {
                if (!Array.isArray(formDataObject[key])) {
                    formDataObject[key] = [formDataObject[key]];
                }
                formDataObject[key].push(value);
            } else {
                // Check if it's a multi-select, store as array even if one selected
                const element = formElement.elements[key];
                if (element && element.multiple) {
                    formDataObject[key] = [value];
                } else {
                    formDataObject[key] = value;
                }
            }
        });

        // Ensure multi-select fields are always arrays, even if only one option was selected (FormData might not do this by default for all cases)
        // Or handle cases where a multi-select might not have any options selected if not 'required'
        formElement.querySelectorAll('select[multiple]').forEach(select => {
            if (formDataObject[select.name] && !Array.isArray(formDataObject[select.name])) {
                 formDataObject[select.name] = [formDataObject[select.name]];
            } else if (!formDataObject[select.name]) {
                formDataObject[select.name] = []; // Ensure it's an empty array if nothing selected
            }
        });

        // Handle checkboxes for notificationConditions
        formDataObject.notificationConditions = [];
        formElement.querySelectorAll('input[name="notificationConditions"]:checked').forEach(checkbox => {
            formDataObject.notificationConditions.push(checkbox.value);
        });

        // Handle file upload (just the file name for now)
        const fileInput = formElement.querySelector('input[type="file"]');
        if (fileInput && fileInput.files.length > 0) {
            formDataObject[fileInput.name] = fileInput.files[0].name; // Storing filename
        } else {
            formDataObject[fileInput.name] = null;
        }

        return formDataObject;
    }

    function saveConfiguration(data) {
        // In a real application, this would send data to a backend.
        // For now, just log to console.
        console.log("Saving configuration (Step 5):", JSON.stringify(data, null, 2));
        // Simulate async operation for future
        return new Promise((resolve) => setTimeout(() => resolve({success: true, data}), 500));
    }

    function generateGitHubMappingFile(data) {
        // Placeholder for Step 6
        console.log("Generating GitHub mapping file with data (Step 6):", JSON.stringify(data, null, 2));
    }

    function showConfirmation(data) {
        // Placeholder for Step 7
        console.log("Showing confirmation for (Step 7):", JSON.stringify(data, null, 2));
        document.getElementById('summaryText').textContent = JSON.stringify(data, null, 2);
        document.getElementById('confirmationArea').style.display = 'block';
    }

    function validateForm() {
        let isValid = true;
        const requiredInputs = form.querySelectorAll('[required]');

        requiredInputs.forEach(input => {
            if (input.type === 'url' && !isValidUrl(input.value.trim())) {
                alert(`Invalid URL: ${input.previousElementSibling.textContent}`);
                input.style.borderColor = 'red';
                isValid = false;
            } else if (input.type === 'text' && input.id === 'notificationEmails' && !validateEmails(input.value.trim())) {
                alert('Please enter valid email addresses, separated by commas.');
                input.style.borderColor = 'red';
                isValid = false;
            } else if ((input.type === 'text' || input.type === 'url' || input.type === 'number' || input.tagName.toLowerCase() === 'select') && !input.value.trim()) {
                if (input.multiple) { // For multi-select
                    if (input.selectedOptions.length === 0) {
                        alert(`Please select at least one option for ${input.previousElementSibling.textContent}`);
                        input.style.borderColor = 'red';
                        isValid = false;
                    } else {
                        input.style.borderColor = ''; // Reset border color
                    }
                } else {
                    alert(`Please fill out the ${input.previousElementSibling.textContent} field.`);
                    input.style.borderColor = 'red';
                    isValid = false;
                }
            } else {
                input.style.borderColor = ''; // Reset border color if valid or not empty
            }
        });

        // Validate notification conditions (at least one checkbox should be checked)
        const notificationCheckboxes = form.querySelectorAll('input[name="notificationConditions"]');
        const isAnyCheckboxChecked = Array.from(notificationCheckboxes).some(cb => cb.checked);
        if (!isAnyCheckboxChecked) {
            alert('Please select at least one Notification Condition.');
            // Optionally, highlight the checkbox group or a relevant label
            // For simplicity, just an alert for now.
            isValid = false;
        }


        return isValid;
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function validateEmails(emailsString) {
        if (!emailsString) return false; // Required field
        const emailArray = emailsString.split(',').map(email => email.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emailArray) {
            if (!emailRegex.test(email)) {
                return false;
            }
        }
        return true;
    }

    // Reset border color on input/change
    form.querySelectorAll('input[required], select[required]').forEach(input => {
        input.addEventListener('input', () => input.style.borderColor = '');
        input.addEventListener('change', () => input.style.borderColor = '');
    });
     form.querySelectorAll('input[name="notificationConditions"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Potentially remove a general error highlight for the checkbox group here
        });
    });
});
