# GitHub Portfolio Export Feature

## Overview

Students can now export their completed lesson work to a GitHub portfolio repository! This creates a "coloring book" artifact showing:
- The complete canonical program from the lesson
- Student's implementations of key functions
- A test harness to validate their work
- Progress documentation

## How It Works

### For Students

1. **Complete lessons** - Work through concepts and write code implementations
2. **Click "Export to GitHub"** button in the lesson header (appears when ≥1 concept mastered)
3. **Automated export creates:**
   - A `learning-portfolio` repo in their GitHub account (if doesn't exist)
   - A lesson folder (e.g., `tsp-lesson/`) with:
     - `canonical.py` - Full working program from the notebook
     - `my_implementation.py` - Student's implementations
     - `test_harness.py` - Runnable tests
     - `README.md` - Lesson summary with progress badges
   - Updates root `README.md` with completed lessons list

### Repository Structure

```
learning-portfolio/
├── README.md                    # Portfolio index
├── tsp-lesson/
│   ├── README.md                # Lesson summary
│   ├── canonical.py             # Full original program
│   ├── my_implementation.py     # Student's code
│   └── test_harness.py          # Tests
└── paip-lesson/
    └── ...
```

### Running Student Code

```bash
cd learning-portfolio/tsp-lesson
python test_harness.py

# Output:
# ✓ test_distance_3_4_5
# ✓ test_tour_length_example
# ...
# 12 passed, 0 failed
```

## Technical Implementation

### Code Persistence

User code is now **saved to localStorage** as they type:
- Key: `user-code-${libraryId}-${conceptId}`
- Saved automatically when code changes
- Loaded when returning to a concept
- Collected during export

### GitHub Integration

**Authentication:**
- Uses NextAuth.js GitHub OAuth
- Requires `repo` scope for creating/updating repos
- Access token stored in session JWT

**API Endpoint:** `/api/export-github`
- **Method:** POST
- **Body:** `{ libraryId, masteredConcepts[], userCodeMap }`
- **Response:** `{ repoUrl, lessonPath, message }`

**Octokit Operations:**
1. Check if `learning-portfolio` repo exists
2. Create repo if needed (public by default)
3. For each file:
   - Check if exists (get SHA)
   - Create or update with base64 content
4. Update root README with lesson entry
5. Return repo URL

### File Generation

**canonical.py:**
- Full `library_programs.program_code` from database
- Complete working implementation

**my_implementation.py:**
- Extracts function definitions from user's localStorage code
- Filters out test cases (keeps only `def function():` blocks)
- Includes docstrings

**test_harness.py:**
- Imports from `canonical.py` (base context)
- Imports from `my_implementation.py` (overrides)
- Generates test functions from `concept_functions.test_cases`
- Runnable with standard Python

**README.md:**
- Lesson metadata (date, concepts mastered)
- Function table with difficulty and test status
- Running instructions

## Setup Requirements

### For Development

1. **GitHub OAuth App** (already configured):
   - Client ID in `GITHUB_CLIENT_ID`
   - Client Secret in `GITHUB_CLIENT_SECRET`
   - Callback URL: `http://localhost:3000/api/auth/callback/github`

2. **Scopes** (now includes):
   - `read:user` - Read user profile
   - `user:email` - Read user email
   - `repo` - Create and update repositories ⭐ **NEW**

3. **Dependencies:**
   - `@octokit/rest` - GitHub API client (installed)

### For Production

- Update GitHub OAuth app callback URL to production domain
- Ensure `repo` scope is granted (users may need to re-authorize)

## User Experience

### When Export Succeeds:
```
✓ "Successfully exported to GitHub! View at: 
   https://github.com/{username}/learning-portfolio/tree/main/tsp-lesson"
```
- Opens repo in new tab
- Green success banner with dismiss button

### When Export Fails:
```
✗ "Failed to export to GitHub: {error message}"
```
- Red error banner
- Common errors:
  - "GitHub access token not found. Please log in again."
  - "Failed to create repo" (permissions issue)

## Peter's "Coloring Book" Concept

This implements Peter's vision:
- **The coloring book:** Complete canonical program (all the "lines")
- **Student's coloring:** Their implementations (which "pages they colored")
- **Portfolio artifact:** Shareable, runnable proof of learning

Students can say: "Here's what I built!" and link to their repo.

## Future Enhancements

### Potential Improvements:
1. **GitHub Actions CI** - Auto-run tests on push (green badges!)
2. **Diff view** - Show canonical vs. student implementation
3. **Progress visualization** - Graphs showing mastery over time
4. **Export to gist** - For quick sharing without full repo
5. **Private repos** - Option to make portfolio private
6. **Custom repo name** - Let students choose repo name
7. **Branch per lesson** - Alternative structure (main + branches)

### Could Also Export:
- PCG graph visualization (SVG/PNG)
- Learning statistics (time spent, attempts, etc.)
- Dialogue transcript (anonymized)
- Jupyter notebook version

## Testing

### Manual Test Flow:
1. Start lesson, master ≥1 concept with code
2. Click "Export to GitHub"
3. Check success message
4. Visit repo URL
5. Clone and run `python test_harness.py`
6. Verify tests pass

### Test Accounts:
- Use your own GitHub account
- Or create test account for development

## Debugging

### Common Issues:

**"GitHub access token not found"**
- User needs to log out and log back in
- Check `repo` scope in GitHub OAuth settings

**"Failed to create repo"**
- Check GitHub API rate limits
- Verify OAuth app has correct permissions

**Tests fail in exported code**
- Check `programCode` in database is complete
- Verify test cases in `concept_functions` are valid
- Ensure user's code was properly saved to localStorage

### Logging:
- Frontend: Check browser console for export errors
- Backend: Check server logs for API errors
- GitHub: Check repo commit history for file updates

## Questions for Peter

1. **Repo naming:** Is `learning-portfolio` a good default name?
2. **Privacy:** Should repos be public or private by default?
3. **Structure:** One repo with folders, or separate repos per lesson?
4. **Additional artifacts:** What else should we include in exports?
5. **CI/CD:** Should we add GitHub Actions for auto-testing?

---

**Status:** ✅ MVP Complete - Ready for Peter's meeting!

**Next Steps:**
1. Demo to Peter
2. Get feedback on structure/UX
3. Test with real lesson
4. Iterate based on feedback
