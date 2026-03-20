/**
 * Connector Router — mounts all connector sub-routes.
 */

import { Router } from 'express';
import githubRoutes from './github.js';
import googleDocsRoutes from './google-docs.js';
import slackRoutes from './slack.js';
import jiraRoutes from './jira.js';
import hubspotRoutes from './hubspot.js';
import airtableRoutes from './airtable.js';

const router = Router();

router.use('/github', githubRoutes);
router.use('/google-docs', googleDocsRoutes);
router.use('/slack', slackRoutes);
router.use('/jira', jiraRoutes);
router.use('/hubspot', hubspotRoutes);
router.use('/airtable', airtableRoutes);

export default router;
