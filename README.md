# Caprine Clinic

Search diagnostics for the herd. Run Splunk searches side by side, compare their performance, and see where their results differ—all inside Splunk Web.

## Install and open

Download the app archive from [GitHub Releases](https://github.com/yaleman/caprine-clinic/releases), then install it using **Apps → Manage Apps → Install app from file** in Splunk Web. Open **Caprine Clinic → Compare searches** from the Apps menu. You need permission to install apps, or an administrator to install it for you; searches use your signed-in Splunk account and its permissions.

Caprine Clinic has been tested on Splunk Enterprise **10.4.4**. Other versions and Splunk Cloud have not been validated.

## Compare searches

1. Enter your SPL in **Search A** and **Search B**. Use **Add search** for another panel, or **Duplicate** to try a variation of an existing search.
2. Choose a **Shared time range** and **Search mode**. Each panel uses these settings by default. Uncheck **Use shared time range** or select a panel-specific mode to override them. Changing a panel's time picker while sharing is enabled changes the shared range.
3. Click a panel's green search button to run it independently, or **Run all** to submit every panel together. Use **Cancel** or **Cancel all** to stop active jobs.
4. Choose **Set baseline** on the search you want to compare against. **Compare final runs** shows runtime, result and event counts, scanned events, disk usage, and runtime change relative to the baseline when comparable.
5. Open **Job details** for statistics, events, available previews, execution costs, and job properties/messages. Use the page controls to browse results.

The initial example searches use the local development fixture index `caprine_clinic_test`. Replace them with searches for your own data after installing the app elsewhere.

## Compare result differences

Select a baseline and a **Candidate**, then click **Compare results** after both jobs complete. Leave **Fields** empty to compare all returned fields, or enter comma-separated field names to compare just those values.

Comparison ignores row order and counts duplicates: returning the same row twice differs from returning it once. The difference tables show rows found only in the baseline or candidate. The comparison label tells you whether all final rows were fetched; incomplete data cannot establish full equality. Large comparisons fetch results into your browser and can use substantial memory.

## Read the timings

**Run all** submits searches together, so they share Splunk resources. Runtime differences describe those runs; cache state, other workloads and search mode can affect them. A single run does not establish that one search is always faster. Missing job metrics appear as unavailable.

Relative historical ranges are resolved against one Splunk server time anchor for each launch. Use the same interval and mode for a fair comparison. Searches run separately, real-time ranges, and time bounds or macros inside SPL may cover different data. Runtime percentages are shown only for completed runs from the same batch with matching resolved time bounds.

## Jobs and workspace

Splunk governs search permissions, time ranges, runtime and concurrency. Caprine Clinic adds no execution limits. SPL runs with your account's capabilities, including commands that can write data.

Editing a panel does not change its existing job; **Edited since run** marks changes made after submission. Cancel an active job before rerunning that panel. Refreshing or closing the page resets the workspace and does not cancel server jobs. Save searches you want to keep, and use Splunk's job management if you need to inspect jobs after leaving the page.

If dispatch acknowledgement is lost, check your Splunk jobs before retrying: a job may already exist. Permission, quota and expired-job errors are reported from Splunk.
