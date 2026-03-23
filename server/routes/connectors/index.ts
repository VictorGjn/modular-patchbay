/**
 * Connector Router — mounts all connector sub-routes.
 */

import { Router } from 'express';
// Wave 1
import githubRoutes from './github.js';
import googleDocsRoutes from './google-docs.js';
import slackRoutes from './slack.js';
import jiraRoutes from './jira.js';
import hubspotRoutes from './hubspot.js';
import airtableRoutes from './airtable.js';
// Wave 2
import linearRoutes from './linear.js';
import confluenceRoutes from './confluence.js';
import googleSheetsRoutes from './google-sheets.js';
import gmailRoutes from './gmail.js';
import googleDriveRoutes from './google-drive.js';
// Extra
import planeRoutes from './plane.js';

const router = Router();

// Wave 1
router.use('/github', githubRoutes);
router.use('/google-docs', googleDocsRoutes);
router.use('/slack', slackRoutes);
router.use('/jira', jiraRoutes);
router.use('/hubspot', hubspotRoutes);
router.use('/airtable', airtableRoutes);
// Wave 2
router.use('/linear', linearRoutes);
router.use('/confluence', confluenceRoutes);
router.use('/google-sheets', googleSheetsRoutes);
router.use('/gmail', gmailRoutes);
router.use('/google-drive', googleDriveRoutes);
// Extra
router.use('/plane', planeRoutes);

export default router;
