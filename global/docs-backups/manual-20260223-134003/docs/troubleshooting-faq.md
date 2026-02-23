# Troubleshooting & FAQ

## Who Should Read This?

- Support team
- Operations users
- On-call engineers

## Quick Triage Flow

1. Identify scope: global, company, branch, vendor, or mobile
2. Capture user, time, and action attempted
3. Check permissions first
4. Verify related record status and dependencies
5. Check API/log errors and retry behavior

## Frequent Issues

## "I cannot see a menu/page"
- Check role and scope permissions
- Confirm user is in correct company/branch context

## "Stock is wrong"
- Review latest inventory movements
- Verify transfer/receipt status
- Check for pending adjustments

## "PO closed but stock not available"
- Verify GRN completion
- Confirm move-to-inventory action executed

## "Invoice numbers or totals look incorrect"
- Recheck line-level data and taxes
- Verify no duplicate manual edits
- Validate accounting posting status

## "API call works in Postman but not app"
- Compare auth token, headers, and payload fields
- Confirm environment base URL and route path
- Check CORS/network constraints for frontend calls

## Escalation Template

- Scope:
- User:
- Timestamp:
- Endpoint/Page:
- Error message:
- Steps to reproduce:
- Business impact:

## Response Targets

- High impact (billing/data loss): immediate
- Medium impact (workflow blocked): within same day
- Low impact (UI inconsistency): scheduled fix window
