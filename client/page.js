"use strict"

import m from "mithril";

import {ALL_CERT_TYPES} from "./certTypes"
import Icons            from "./icons.js"


/**
 * A base Mithril component for all Mr. Cert pages.
 *
 * This keeps all pages uniform and handles the basic structure and content in
 * one place. This should not be used directly, but subclassed to display the
 * appropriate content.
 *
 * # Subclassing:
 * When subclassing be sure to override the content() function, but **do not**
 * override the view() function. That will handle displaying the main content of
 * the page. This will be called every time Mithril calls the view() function.
 *
 * @hideconstructor
 */
export class Page
{
    /**
     * The view function for this Mithril component.
     *
     * Mithril will call this function every time it redraws the page. This, in
     * turn, will call the content() function to render the main content of the
     * page. **Do not** override this function.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page is being
     *                       rendered.
     *
     * @return {VNode}
     *     The rendered page for Mitrhil.
     *
     * @private
     */
    view(vnode)
    {
        let nav_content = [];
        for (const {type, name} of ALL_CERT_TYPES)
        {
            nav_content.push(m("li", m(m.route.Link, {href: `/${type}`}, `${name}s`)));
        }

        let subtitle_node = this.subtitle(vnode);
        if (subtitle_node)
        {
            subtitle_node = m("h2", subtitle_node);
        }

        return [m("header", [m("h1", "Mr. Cert"), subtitle_node]),
                m("nav", m("ul", nav_content)),
                m("div", {class: "content"}, this.content(vnode)),
                m("footer", "The preferred certificate authority of Dark Helmet.")];
    }

    /**
     * This function provides the text for the page's subtitle.
     *
     * When subclassing Page the derived class should reimplement this function
     * if the page needs a subtitle. It is provided the
     * same Mithril VNode object as the view() function allowing use of the
     * VNode's properties when rendering.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page is being
     *                       rendered.
     *
     * @returns {string}
     *     The subtitle to be displayed on the page.
     *
     * @virtual
     */
    subtitle(vnode)
    {
        return null;
    }

    /**
     * This function provides the content for the page.
     *
     * When subclassing Page the derived class should reimplement this function
     * to provide the content for the page being displayed. It is provided the
     * same Mithril VNode object as the view() function allowing use of the
     * VNode's properties when rendering.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page is being
     *                       rendered.
     *
     * @return {VNode}
     *     The rendered content for Mitrhil, to be included in the page.
     *
     * @virtual
     */
    content(vnonde)
    {
        return "";
    }
};


/**
 * A page that loads content from the server before it can be displayed.
 *
 * # Subclassing:

 * When subclassing be sure to override the request() and loadedContent()
 * functions, but **do not** override the oninit(), onupdate(), and content()
 * functions. The {@link LoadingPage#request} function will be called when the
 * page is loaded to fetch whatever data are needed from the server. Once the
 * request(s) have successfully finished the {@link LoadingPage#loadedContent}
 * function will be called whenever the page draws.
 *
 * @hideconstructor
 */
export class LoadingPage extends Page
{
    /**
     * The function called when the page is first loaded.
     *
     * This function is automatically called by Mithril each time a page is
     * loaded. In this case the {@link LoadingPage#request}() function is called
     * to request whatever data are needed from the server.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page will be
     *                       rendered.
     *
     * @private
     */
    oninit(vnode)
    {
        this._loading_state = {ready:  false,
                               failed: false,
                               attrs:  vnode.attrs};

        this.whileLoading(this.request(vnode));
    }

    /**
     * The function called whenver the page is updated.
     *
     * This is automatically called by Mithril. We use it to call
     * {@link LoadingPage#oninit} again if the VNode's 'attrs' have changed.
     *
     * @private
     */
    onupdate(vnode)
    {
        if (this._loading_state.attrs != vnode.attrs)
        {
            // We need to load new data, so we will treat this the same as
            // initialization.
            this.oninit(vnode);
        }
    }

    /**
     * Request data needed by this page from the server.
     *
     * When subclassing LoadingPage the derived class should reimplement this
     * function to handle fetching whatever data are needed to display this
     * page. It is recommended that Mitril's m.request() function is used to
     * create the requests.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page will be
     *                       rendered.
     *
     * @return {Promise | Promise[] | *}
     *     This should return whatever promises are created by the data
     *     requests.
     *
     * @virtual
     */
    request(vnode)
    {
    }

    /**
     * The page's content.
     *
     * **Do not** override this as you would when extending from {@link Page},
     * instead override {@link LoadingPage#loadedContent}. This handles drawing
     * the page's content when loading of if there was an error when loading.
     * Once loading has successfully completed this simply calls {@link
     * LoadingPage#loadedContent}.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page is being
     *                       rendered.
     *
     * @return {VNode}
     *     The rendered content for Mitrhil, to be included in the page.
     *
     * @private
     */
    content(vnode)
    {
        if (this._loading_state.ready)
        {
            return this.loadedContent(vnode);
        }
        else if (this._loading_state.failed)
        {
            /// @todo Make this nicer.
            return m("strong", 404);
        }
        else
        {
            return m("div",
                     {class: "loading"},
                     Icons.compactDisc({class: "spinner"}));
        }
    }

    /**
     * This function provides the content for the page.
     *
     * When subclassing LoadingPage the derived class should reimplement this
     * function to provide the content for the page being displayed. It is
     * provided the same Mithril VNode object as the content() function allowing
     * use of the VNode's properties when rendering.
     *
     * *Note:* This will only be called once loading has successfully completed.
     *
     * @param {VNode} vnode  The Mithril VNode into which this page is being
     *                       rendered.
     *
     * @return {VNode}
     *     The rendered content for Mitrhil, to be included in the page.
     *
     * @virtual
     */
    loadedContent()
    {
        return "";
    }

    /**
     * Display a loading page until the promises resolve.
     *
     * This provides the exact behavior as the initial loading of the page. This
     * is useful when communication with the server is necessary even though the
     * page isn't being reloaded from Mithril's perspective.
     *
     * @param {Promise | Promise[]} promises  One or more promises that comprise the loading action. The page will display as loading until all of these are resolved.
     */
    whileLoading(promises)
    {
        this._loading_state.ready  = false;
        this._loading_state.failed = false;
        m.redraw();

        if (!Array.isArray(promises))
        {
            promises = [promises];
        }
        Promise.all(promises).then(
            (results) => {
                this._loading_state.ready = true;
                m.redraw();

                return results;
            },
            (error) => {
                console.error(error);
                this._loading_state.failed = true;
                m.redraw();
            });
    }
};
