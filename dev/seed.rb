# frozen_string_literal: true
#
# Seeds the dev Redmine with everything the extension needs to exercise:
# REST API enabled, an admin API key, the default trackers/statuses/priorities/
# activities, two projects, extra members, issues with journals and watchers,
# time entries and news.
#
# Run:
#   docker compose -f dev/docker-compose.yml exec redmine \
#     rails runner /dev-scripts/seed.rb
#
# Safe to re-run: every step is guarded.

def say(msg) = warn("[seed] #{msg}")

# --- 1. Default configuration data ------------------------------------------
# A fresh Redmine has NO trackers, statuses, priorities or time-entry activities
# until the default data set is loaded. Without this the extension's enum
# endpoints all return empty arrays.
if Redmine::DefaultData::Loader.no_data?
  Redmine::DefaultData::Loader.load('en')
  say 'loaded default data (trackers, statuses, priorities, activities, roles)'
else
  say 'default data already present'
end

# --- 2. Settings -------------------------------------------------------------
Setting.rest_api_enabled = '1'
Setting.login_required   = '0'
# Seeding creates a lot of issues; nobody wants the mail queue to light up.
ActionMailer::Base.perform_deliveries = false
say 'REST API enabled'

# --- 3. Admin user + API key -------------------------------------------------
PASSWORD = 'redminedev123'

admin = User.find_by_login('admin')
admin.must_change_passwd   = false
admin.password             = PASSWORD
admin.password_confirmation = PASSWORD
admin.save!

api_key = admin.api_key # creates the API token on first call

begin
  File.write('/dev-scripts/.api-key', "#{api_key}\n")
  say 'wrote API key to dev/.api-key'
rescue StandardError => e
  say "could not write dev/.api-key (#{e.class}); copy it from the output below"
end

# --- 4. Extra users ----------------------------------------------------------
def ensure_user(login, firstname, lastname)
  existing = User.find_by_login(login)
  return existing if existing

  User.create!(
    login: login,
    firstname: firstname,
    lastname: lastname,
    mail: "#{login}@example.test",
    password: PASSWORD,
    password_confirmation: PASSWORD,
    must_change_passwd: false,
    status: User::STATUS_ACTIVE,
    language: 'en'
  )
end

members = [
  ensure_user('jdoe',  'Jane',  'Doe'),
  ensure_user('bsmith', 'Bob',  'Smith'),
  ensure_user('agarcia', 'Ana', 'Garcia')
]
say "users: #{(members.map(&:login) + ['admin']).join(', ')}"

# --- 5. Projects -------------------------------------------------------------
def ensure_project(identifier, name, description)
  existing = Project.find_by_identifier(identifier)
  return existing if existing

  project = Project.create!(
    name: name,
    identifier: identifier,
    description: description,
    is_public: true
  )
  project.enabled_module_names = %w[issue_tracking time_tracking news wiki files documents]
  project.trackers = Tracker.all
  project.save!
  project
end

sandbox = ensure_project('sandbox', 'Sandbox', 'Primary playground for the Redmine Helper extension.')
second  = ensure_project('side-quest', 'Side Quest', 'Second project, used to exercise project filtering.')
say "projects: #{[sandbox, second].map(&:identifier).join(', ')}"

# --- 6. Memberships ----------------------------------------------------------
role = Role.givable.find_by(name: 'Manager') || Role.givable.first

[sandbox, second].each do |project|
  ([admin] + members).each do |user|
    next if Member.exists?(project_id: project.id, user_id: user.id)

    Member.create!(project: project, user: user, roles: [role])
  end
end
say 'memberships created'

# --- 7. Issues, journals, watchers -------------------------------------------
TRACKERS   = Tracker.all.to_a
STATUSES   = IssueStatus.sorted.to_a
PRIORITIES = IssuePriority.active.to_a

SUBJECTS = [
  'Login form rejects valid credentials',
  'Add pagination to the reports table',
  'Timezone handling is wrong in the digest email',
  'Upgrade the PDF export dependency',
  'Search returns duplicates for archived records',
  'Write onboarding docs for the API',
  'Flaky test in the billing suite',
  'Dark mode contrast fails WCAG AA',
  'Rate limit the webhook endpoint',
  'Migrate uploads to object storage',
  'Session expires too aggressively on mobile',
  'Add CSV import for contacts',
  'Fix N+1 query on the dashboard',
  'Broken deep link from notification emails',
  'Support SSO via SAML'
].freeze

if Issue.count >= SUBJECTS.length
  say "issues already seeded (#{Issue.count}); skipping"
else
  everyone = [admin] + members

  SUBJECTS.each_with_index do |subject, i|
    project = i.even? ? sandbox : second

    issue = Issue.create!(
      project: project,
      tracker: TRACKERS[i % TRACKERS.length],
      subject: subject,
      description: "Seeded issue ##{i + 1}.\n\nSteps:\n1. Do the thing\n2. Observe the wrong thing\n\nExpected: the right thing.",
      author: everyone[i % everyone.length],
      # Most issues land on admin so the extension's `assigned_to_id=me` poll
      # has something to find; the rest exercise the watcher path.
      assigned_to: i % 3 == 2 ? members[i % members.length] : admin,
      status: STATUSES[i % STATUSES.length],
      priority: PRIORITIES[i % PRIORITIES.length],
      done_ratio: (i % 5) * 25,
      estimated_hours: [nil, 2, 4.5, 8, 16][i % 5],
      start_date: Date.today - (i * 2)
    )

    # A couple of journal entries so the history renderer has real data:
    # a plain note, plus an attribute change that produces journal details.
    #
    # Reload before each journal: Issue uses optimistic locking, and create!/save!
    # fire callbacks that bump lock_version in the database behind the in-memory
    # object, so reusing it raises StaleObjectError.
    issue.reload
    issue.init_journal(members[i % members.length], 'Taking a look at this now.')
    issue.save!

    issue.reload
    issue.init_journal(admin, 'Bumping priority and reassigning.')
    issue.priority   = PRIORITIES[(i + 1) % PRIORITIES.length]
    issue.status     = STATUSES[(i + 2) % STATUSES.length]
    issue.done_ratio = [0, 30, 60, 90].sample
    issue.save!

    # Issues admin watches but does not own — exercises the `watcher_id=me` poll.
    issue.add_watcher(admin) if i % 3 == 2
  end
  say "created #{Issue.count} issues with journals and watchers"
end

# --- 8. Time entries ---------------------------------------------------------
activity = TimeEntryActivity.active.first

if activity.nil?
  say 'WARNING: no time entry activities found — time logging will not work'
elsif TimeEntry.count.positive?
  say "time entries already seeded (#{TimeEntry.count}); skipping"
else
  Issue.limit(6).each_with_index do |issue, i|
    TimeEntry.create!(
      project: issue.project,
      issue: issue,
      user: admin,
      author: admin,
      spent_on: Date.today - i,
      hours: [0.25, 0.5, 1.0, 2.5, 3.0, 7.75][i],
      activity: activity,
      comments: 'Seeded time entry'
    )
  end
  say "created #{TimeEntry.count} time entries"
end

# --- 9. News -----------------------------------------------------------------
if News.count.zero?
  News.create!(project: sandbox, title: 'Sandbox is open', description: 'Seeded news item for the extension news feed.', author: admin)
  News.create!(project: sandbox, title: 'API key rotation', description: 'Second seeded news item.', author: admin)
  say 'created news items'
else
  say "news already seeded (#{News.count}); skipping"
end

# --- Summary -----------------------------------------------------------------
warn <<~SUMMARY

  ============================================================
   Redmine dev instance ready
  ------------------------------------------------------------
   URL      : #{ENV.fetch('REDMINE_PUBLIC_URL', 'http://localhost:3001')}
   Login    : admin / #{PASSWORD}
   API key  : #{api_key}
  ------------------------------------------------------------
   Paste the URL + API key into the extension's Options page.
  ============================================================

SUMMARY
