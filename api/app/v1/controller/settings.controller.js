'use strict';

/**
 * The settings menu and the refresh button. Only `updateSettings` reads the
 * request; the others are commands with nothing to say beyond their route.
 *
 * Installing is a PUT and removing a DELETE, not POSTs, on purpose: a browser
 * sends those cross-origin only after a CORS preflight, which a page from
 * another origin fails, so a web page the person happens to open cannot
 * rewrite their Claude Code settings through this machine's loopback.
 */
export const SettingsController = ({
  getSettings,
  installHooks,
  refreshSessions,
  removeHooks,
  responseHandler,
  updateSettings,
}) => {
  const command = useCase => (request, reply) =>
    useCase({ data: {}, onFinish: responseHandler(request, reply) });

  return {
    getSettings: command(getSettings),
    installHooks: command(installHooks),
    refreshSessions: command(refreshSessions),
    removeHooks: command(removeHooks),
    updateSettings: (request, reply) =>
      updateSettings({ data: request.body, onFinish: responseHandler(request, reply) }),
  };
};
