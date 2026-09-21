**As a tenant, I want a tenant-themed dashboard, so that it is easier to add pictures and information.**

- **GIVEN** I am logged in as a tenant, **WHEN** I open the app, **THEN** I see a tenant dashboard showing my unit, my upcoming inspections, and options to add photos and report a maintenance problem.
- **GIVEN** I have an inspection that is due, **WHEN** I view my dashboard, **THEN** I can start submitting photos for that inspection directly from the dashboard.

**As a Landlord, I want a landlord-themed dashboard, so that I can manage multiple properties.**

- **GIVEN** I am logged in as a landlord with more than one property, **WHEN** I open the app, **THEN** I see all my units with a sign with the number of things I need to review for that unit.

**As a user, I want to be able to reset my password so that I can log back into my account if I forget my password.**

- **GIVEN**, I am a user with an account, **WHEN** I click “Forgot Password”, **THEN** I should receive an email that will allow me to reset the password.

**As a landlord, I want to assign a tenant to a unit, so that the right person is prompted to complete inspections for it**

- **GIVEN** I have added a unit with no tenant assigned, **WHEN** I select a tenant to link to that unit, **THEN** that tenant is prompted to complete inspections and submissions for it.

**As a landlord, I want to edit a unit's details, so that I can keep property information accurate over time.**

- **GIVEN** I have a unit on my dashboard, **WHEN** I update its details and save, **THEN** the changes are reflected across the app.

**As a landlord, I want to add a new property and its units, so that I can start tracking conditions for it in the app.**

- **GIVEN** I am logged in as a landlord. **When** I enter the property address and add one or more units, **THEN** the property and its units appear on my dashboard.

**As a landlord, I want to schedule an inspection, so that I can verify property conditions.**

- **GIVEN** I am logged in and have a unit on my dashboard, **WHEN** I choose a date for an inspection, **THEN** the inspection appears on the unit's schedule, and the tenant is notified that photos are due.

**As a tenant, I want to give the landlord my availability, so that we can settle on a date for in-person inspections.**

- **GIVEN** I am logged in as a tenant and my landlord has requested an in-person inspection, **WHEN** I select the dates and time slots I am available and submit them, **THEN** my availability is sent to the landlord and shown on the inspection request.

**As a tenant, I want to see instructions for which areas to photograph, so that I know what parts of the property need to be documented.**

- **GIVEN** I have started an inspection, **WHEN** I select an inspection area, **THEN** the application should display instructions for what I need to photograph.
- **GIVEN** instructions are displayed, **WHEN** I follow the instructions, **THEN** I should be able to capture a photo of the required area.

**As a tenant, I want to retake a photo, so that I can correct a blurry or unclear photo before submitting my inspection.**

- **GIVEN** I have taken a photo, **WHEN** I select the retake option, **THEN** the application should allow me to take another photo.
- **GIVEN** I take a replacement photo, **WHEN** I accept it, **THEN** the new photo should replace the previous photo.

**As a landlord, I want to see the severity of the detected changes, so that I can prioritize potential serious damage.**

- **GIVEN** a tenant has submitted photos and the AI comparison has finished, **WHEN** I open the inspection results, **THEN** each detected change shows whether it looks like normal wear or potential damage, along with a severity level.

**As a landlord, I want to see detected changes between the baseline and inspection photos so that I can identify changes in the property's condition.**

- **GIVEN** a baseline photo and a new inspection photo have been submitted, **WHEN** the AI comparison is finished, **THEN** the system displays any detected visible changes.

**As a landlord, I want to mark an AI-flagged change as resolved, dismissed, or confirmed damage, so that the final decision is mine and not automated.**

- **GIVEN** the AI has flagged a change in an inspection, **WHEN** I review it, **THEN** I can set its status to resolved, dismissed, or confirmed damage.

**As a landlord, I want to be notified when there is a high-severity change detected so that I can act quickly.**

- **GIVEN** I am logged in on the app, **WHEN** there is a high severity finding **THEN** I should receive a notification.

**As a tenant, I want to select a room, wall, appliance, or other area and attach a photo or video, so that I can clearly show the landlord what needs repair.**

- **GIVEN** I am logged in as a tenant, **WHEN** I select an area, attach a photo or video, and add a description, **THEN** a repair request is created and appears in my list of reported issues.

**As a landlord, I want to be notified when a tenant reports a maintenance issue, so that I can respond immediately.**

- **GIVEN** a tenant has submitted a maintenance request, **WHEN** it is created, **THEN** I receive a notification with a summary of the issue.

**As a landlord, I want to be able to track the status of the issues, So that I know when the issues are fixed or if they need more attention.**

- **Given**, I am looking at the issues reported by the tenant, **WHEN** I click on them, **THEN** I should be able to see a status.

**As a landlord, I want to view a history of inspections for each property, so that I can track how the property's condition changes over time.**

- **GIVEN** a property has completed inspections, **WHEN** I open the condition history, **THEN** I can see the property's previous inspections.
- **GIVEN** multiple inspections exist, **WHEN** I view the inspection history, **THEN** each inspection displays its date and associated unit.

**As a tenant, I want to view the condition history of my unit so that I can see how the condition has changed since I moved in.**

- **GIVEN** I am logged in as a tenant, **WHEN** I open my unit's condition history, **THEN** I can see the move-in baseline and every subsequent inspection's photos, each with its date and time.
