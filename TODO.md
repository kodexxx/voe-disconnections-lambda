# 📋 TODO List - VOE Disconnection Bot

## ✅ Recently Completed

### Architecture & Code Quality (2025-01)
- [x] Implement queue-based architecture with AWS SQS
  - [x] Create Update Queue for subscription processing
  - [x] Create Notification Queue for Telegram notifications
  - [x] Add Dead Letter Queues (DLQ) with monitoring
  - [x] Implement exponential backoff retry mechanism
- [x] Refactor to NestJS-like architecture
  - [x] Separate modules into distinct folders
  - [x] Implement Module/Controller/Service pattern
  - [x] Add createCachedModule for Lambda optimization
- [x] Enforce Single Responsibility Principle
  - [x] Extract interfaces to separate files
  - [x] Extract utilities to common/utils
  - [x] One class/function per file
- [x] Centralize configuration
  - [x] Move all env variables to src/config.ts
  - [x] Remove direct process.env access
- [x] Translate all code to English
  - [x] Comments in source files
  - [x] serverless.yml comments
  - [x] Handler documentation
- [x] Create comprehensive documentation
  - [x] ARCHITECTURE_RULES.md
  - [x] CLAUDE.md for AI assistants
  - [x] queue-architecture.md
  - [x] migration-guide.md

## 🎯 High Priority

### 1. Improve subscription setup dialog flow
- [ ] Add retry attempts on failed search
  - [ ] Allow re-entering city if not found
  - [ ] Allow re-entering street if not found
  - [ ] Allow re-entering house if not found
  - [ ] Add attempt counter (max 3 tries)
- [ ] Move cancel button from `/cancel` command to inline button
  - [ ] Add inline "❌ Cancel" button on each step
  - [ ] Remove need to type `/cancel` manually
  - [ ] Show button with main message
- [ ] Add "🔙 Back" button to return to previous step
  - [ ] Return from street selection to city
  - [ ] Return from house selection to street
- [ ] Improve UX for list selection
  - [ ] Add pagination if more than 8 results
  - [ ] Show count of found results
  - [ ] Add "Search different" button

### 2. Improve selection via inline bot
- [ ] Research inline bot capabilities for address selection
- [ ] Implement inline query for city search
  - [ ] Search cities via @bot_name city
  - [ ] Display results in inline mode
- [ ] Implement inline query for street search
- [ ] Implement inline query for house search
- [ ] Add callback for selection
  - [ ] Handle callback_query for each step
  - [ ] Display selected option in chat
  - [ ] Confirm selection before saving

### 3. Add bot commands
- [ ] `/start` - Start message (✅ already exists)
- [ ] `/help` - Bot capabilities help
  - [ ] List of all commands
  - [ ] Usage examples
  - [ ] FAQ
- [ ] `/settings` - Quick access to subscription settings
- [ ] `/schedule` - Current disconnection schedule
- [ ] `/calendar` - Get calendar link
- [ ] `/unsubscribe` - Cancel subscription
- [ ] `/about` - Bot information
  - [ ] Bot version
  - [ ] Support chat link
  - [ ] Developer contacts
- [ ] Add command descriptions via BotFather
  - [ ] Use `setMyCommands` API
  - [ ] Ukrainian localization

### 4. Add calendar link
- [ ] Implement .ics file link generation
  - [ ] Endpoint for calendar download
  - [ ] Generate unique token for each user
- [ ] Add "📅 Download calendar" button in menu
- [ ] Instructions for adding calendar
  - [ ] For Google Calendar
  - [ ] For Apple Calendar
  - [ ] For Outlook
- [ ] Add calendar subscription via URL
  - [ ] Webhook endpoint for calendar
  - [ ] Auto-update on schedule change
- [ ] Send .ics file directly in Telegram
  - [ ] Generate file on-the-fly
  - [ ] Send via sendDocument API

## 🔥 Medium Priority

### 5. Parse emergency disconnections
- [ ] Research VOE API for emergency disconnections
  - [ ] Find endpoint for emergency disconnections
  - [ ] Analyze data structure
- [ ] Implement emergency disconnections parser
  - [ ] Create interface for emergency disconnections
  - [ ] Add method to VoeFetcherService
- [ ] Add notifications for emergency disconnections
  - [ ] Real-time notifications on emergency detection
  - [ ] Separate message with "🚨 EMERGENCY" label
- [ ] Display emergency disconnections separately from planned
  - [ ] Different message style
  - [ ] Priority notifications
- [ ] Add option to subscribe only to emergencies
  - [ ] Notification type settings
  - [ ] Filter by disconnection type

### 6. Expand to other regions
- [ ] Research APIs of other oblenergo
  - [ ] DTEK (Kyiv, Dnipropetrovsk regions)
  - [ ] Lvivoblenergo
  - [ ] Kharkivoblenergo
  - [ ] Odesaoblenergo
  - [ ] Zaporizhzhiaoblenergo
- [ ] Create adapters for other regions
  - [ ] Abstract base class/interface for adapter
  - [ ] Implementation for each region
- [ ] Add region selection during setup
  - [ ] Region selection step before city
  - [ ] Auto-detect region by city
- [ ] Add support for multiple subscriptions
  - [ ] Subscribe to multiple addresses
  - [ ] Manage subscription list
  - [ ] Delete individual subscriptions

## 💡 Nice to Have

### 7. UX/UI Improvements
- [ ] Add custom keyboard with quick actions
  - [ ] "View schedule" button
  - [ ] "Change address" button
  - [ ] "Notification settings" button
- [ ] Add option to disable notifications temporarily
  - [ ] "Do not disturb until morning"
  - [ ] "Do not disturb for hour/day"
- [ ] User statistics
  - [ ] Number of disconnections per month
  - [ ] Total time without power
  - [ ] Disconnection chart
- [ ] Dark/light theme for messages
  - [ ] Choose display style

### 8. Analytics and Monitoring
- [ ] Add event logging
  - [ ] New user registration
  - [ ] Subscription changes
  - [ ] Parsing errors
- [ ] Usage metrics
  - [ ] Number of active users
  - [ ] Popular commands
  - [ ] Bot response time
- [ ] Error notifications to developer
  - [ ] Critical errors in Telegram
  - [ ] Sentry/CloudWatch integration
- [ ] Admin dashboard
  - [ ] User statistics
  - [ ] Error monitoring
  - [ ] Broadcast message management

### 9. Additional Features
- [ ] Share subscription with others
  - [ ] Generate link for quick subscription
  - [ ] Deep linking for auto-setup
- [ ] Group chats
  - [ ] Add bot to groups
  - [ ] Shared subscription for group
  - [ ] Admin functions in groups
- [ ] Schedule check reminders
  - [ ] Daily reminder at 8 PM
  - [ ] Configure reminder time
- [ ] Export disconnection history
  - [ ] Excel/CSV file with history
  - [ ] Period statistics
- [ ] Map integration
  - [ ] Display disconnection zones on map
  - [ ] Geolocation for auto-address detection

### 10. Technical Improvements
- [ ] Add tests
  - [ ] Unit tests for services
  - [ ] Integration tests for API
  - [ ] E2E tests for bot
- [ ] Refactor conversation flow
  - [ ] Extract to separate modules
  - [ ] Reusable code for steps
- [ ] Optimize DynamoDB queries
  - [ ] Cache results
  - [ ] Batch operations
- [ ] Add rate limiting
  - [ ] Limit requests per user
  - [ ] Anti-spam measures
- [ ] CI/CD pipeline
  - [ ] Automated testing
  - [ ] Automated deployment
  - [ ] Staging environment
- [ ] Documentation
  - [ ] API documentation
  - [ ] System architecture
  - [ ] Deployment guide

## 🐛 Bug Fixes / Technical Debt
- [x] Fix invalid lastUpdatedAt date handling
- [x] Fix MarkdownV2 escaping for special characters
- [x] Fix repository field mapping for lastUpdatedAt
- [x] Add retry mechanism for API calls (✅ implemented in queue system)
- [x] Handle timeout for long requests (✅ via SQS + DLQ)
- [ ] Validate user input data
- [ ] Add input sanitization
- [ ] Improve error messages for users

## 🔄 Queue System TODOs
- [ ] Add metrics dashboard for queue monitoring
- [ ] Implement alerting for DLQ threshold breaches
- [ ] Add batch size tuning based on performance metrics
- [ ] Implement circuit breaker pattern for external APIs
- [ ] Add queue message deduplication
- [ ] Optimize cold start times for queue processors

---

## 📝 Notes
- Priorities may change
- Add new ideas here
- Mark completed tasks with [x]

**Last Updated:** January 2025
