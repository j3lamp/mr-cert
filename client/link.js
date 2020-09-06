"use strict"
/** @module link */

import m from "mithril";

import Icons from "./icons.js"


/**
 * Create a link
 *
 * Creates a Mithril Router link by piecing together a URL for the two halves
 * provided. Optionally prepends the desired icon to `link_name`.
 *
 * @param {string}         url_base   The base portion of the URL.
 * @param {string}         url_end    The remaining portion of the URL. This is
 *                                    appended to 'url_bse' with a slash (/)
 *                                    separating the two strings.
 * @param {string | VNode} link_name  The link text to show the user. This may
 *                                    be a VNode created with Mithril's m()
 *                                    function.
 * @param {string | null}  icon       The name of the desired icon, or null if
 *                                    no icon is desired.
 *
 * @return {VNode}
 *     The requested link rendered for Mithril's virtual DOM.
 */
export function link(url_base, url_end, link_name, icon=null)
{
    link_name = Icons.addTo(link_name, icon);
    return m(m.route.Link, {href: `${url_base}/${url_end}`}, link_name);
}

/**
 * Create a link for downloading a file.
 *
 * This is nearly identical to the {@link module:link.link} function except that
 * the browser will download the linked location rather than loading it. Because
 * of this difference a regular link is created rather than one from Mithril's
 * Router.
 *
 * @param {string}         url_base   The base portion of the URL.
 * @param {string}         file_name  The name of the file to download. This is
 *                                    appended to 'url_bse' with a slash (/)
 *                                    separating the two strings.
 * @param {string | VNode} link_name  The link text to show the user. This may
 *                                    be a VNode created with Mithril's m()
 *                                    function.
 * @param {string | null}  icon       The name of the desired icon, or null if
 *                                    no icon is desired.
 *
 * @return {VNode}
 *     The requested link rendered for Mithril's virtual DOM.
 */
export function downloadLink(url_base, file_name, link_name, icon=null)
{
    link_name = Icons.addTo(link_name, icon);
    return m("a", {href: `${url_base}/${file_name}`, download: file_name}, link_name);
}
