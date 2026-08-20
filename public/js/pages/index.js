/**
 * 页面路由表：统一注册所有页面
 */

import { dashboardPage } from './dashboard.js';
import { reportPage } from './report.js';
import { spreadsheetPage } from './spreadsheet.js';
import { fintodoPage } from './fintodo.js';
import { invoicePage } from './invoice.js';
import { fundPage } from './fund.js';
import { closePage } from './close.js';
import { taxPage } from './tax.js';
import { knowledgePage } from './knowledge.js';
import { studyPage } from './study.js';
import { checkinPage } from './checkin.js';
import { todoPage } from './todo.js';
import { weekreviewPage, monthreviewPage } from './review.js';
import { settingsPage } from './settings.js';

export const routes = {
  dashboard: dashboardPage,
  report: reportPage,
  spreadsheet: spreadsheetPage,
  fintodo: fintodoPage,
  invoice: invoicePage,
  fund: fundPage,
  close: closePage,
  tax: taxPage,
  knowledge: knowledgePage,
  study: studyPage,
  checkin: checkinPage,
  todo: todoPage,
  weekreview: weekreviewPage,
  monthreview: monthreviewPage,
  settings: settingsPage,
};
