## Workforce Scheduling & Timesheet Management System


**Overview**


This project is a full-stack workforce management system designed to help organizations streamline employee scheduling, time tracking, and payroll preparation workflows.


The system centralizes scheduling, clock-ins, and timesheet records in one place, reducing manual work and improving organization.


This project was built to simulate a real-world internal operations tool used by teams managing multiple employees across multiple locations.


---



## Problem


Many organizations rely on manual processes to manage:

employee schedules

paper timesheets

manual hour calculations

shift documentation

mileage tracking




**Manual workflows can:**

require significant administrative time

increase risk of calculation errors

make records harder to track

create inefficiencies in payroll preparation



The goal of this project was to design a simple system that organizes these workflows digitally while keeping the process familiar and easy to adopt.

---


## Solution

The application provides a centralized interface where employees and administrators can manage schedules, track hours, and maintain records efficiently.



**Employees can:**

clock in and clock out digitally

view assigned shifts

record mileage

add daily shift notes



**Administrators can:**

create and manage schedules

monitor employee activity

review timesheets

calculate total worked hours

estimate payroll totals

export schedules as PDF




**Key Features**

Authentication & Role-Based Access

Secure login using Supabase Auth

Separate Admin and Employee permissions

Row Level Security policies applied to protect data access




**Employee Clock In / Clock Out**

Employees can clock in and out digitally

System records timestamps automatically

Location coordinates captured for verification

Total worked hours calculated automatically




**Timesheet Tracking**

Employees can review worked hours in one place

Total hours automatically calculated

Structured records ready for payroll preparation




**Weekly Schedule Management**

Admin can create and edit shifts

Weekly calendar grouped by house and day

Supports multiple employees across multiple locations

Shifts can be added directly from weekly calendar interface




**Mileage & Shift Documentation**

Employees can log mileage per shift

Daily shift notes stored with schedule records

Improves documentation and accountability




**Payroll Preparation Support**

Calculates total hours worked per employee

Date range filtering for payroll periods

Simplifies payroll preparation workflow




**PDF Export**

Weekly schedules can be exported as PDF

Allows easy sharing or printing of schedules

---



## Tech Stack

**Frontend:**

Next.js (React framework)

TypeScript

CSS styling




**Backend:**

Supabase

PostgreSQL database

Row Level Security (RLS)




**Deployment:**

Vercel

---


## Database Structure

**Main tables:**

employees

clock_logs

schedules

houses

profiles

employee_payroll_settings





**Relationships:**

employees linked to schedules and clock logs

schedules linked to houses

profiles linked to authentication roles




**Example Workflow**

Employee clocks in

System stores timestamp in database

Admin can view real-time activity

Employee completes shift

Total hours automatically calculated

Admin reviews timesheets

Payroll preparation simplified


---



## Key Learning Outcomes

Designing relational database schema

Implementing role-based authentication

Building dynamic scheduling interfaces

Handling real-world date and timezone formatting

Calculating worked hours from timestamps

Structuring business logic for payroll preparation

Designing internal tools for operational workflows


---



## Future Improvements

Mobile optimization

Shift notifications

CSV export functionality

Admin analytics dashboard

Enhanced reporting features

Role permission customization


---


## Live Demo
https://care-clock-swart.vercel.app


---


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Required Environment & Supabase Configuration

The employee invitation flow (`/api/create-employee` and `/accept-invite`) requires the following to be configured in **every** environment (local development and production) before it will work end to end.

**Environment variable**

```
APP_URL=http://localhost:3000
```

In production, set this to the deployed domain instead, e.g. `https://your-production-domain.com`. This value is used server-side only, to build the invite email's redirect link (`${APP_URL}/accept-invite`) inside `/api/create-employee`. It intentionally has **no `NEXT_PUBLIC_` prefix** — it is never bundled into client code and is read from server configuration only. It is never derived from the incoming request's origin or `Host` header, so a manipulated request cannot redirect an invite link to an untrusted domain. If this variable is missing or is not a valid `http(s)` URL, employee invitations will fail with a clear error instead of silently falling back to anything request-derived.

**Supabase project configuration**

- **Email delivery** must be enabled for the Supabase project (built-in email service or custom SMTP). Invitation emails will not send otherwise, and the API will return a clear error rather than a temporary password.
- **`${APP_URL}/accept-invite`** must be added to that project's **Authentication → URL Configuration → Redirect URLs** allowlist, for every environment. If it isn't, Supabase will reject the `redirectTo` value and fall back to the project's default Site URL instead of the invite-acceptance page, breaking the onboarding flow for newly invited employees.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
