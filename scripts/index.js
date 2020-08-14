"use strict"

import m from "mithril";

import Icons from "./icons.js"


const CERT_TYPES = [{type: "root",         name: "CA Roots"},
                    {type: "intermediate", name: "CA Intermediates"},
                    {type: "client",       name: "Client Certificates"}];


let root  = document.body;
let state = {ready: false};

class Page
{
    view(vnode)
    {
        let nav_content = [];
        for (const {type, name} of CERT_TYPES)
        {
            nav_content.push(m("li", m(m.route.Link, {href: `/${type}`}, name)));
        }

        return [m("header", m("h1", "Mr. Cert")),
                m("nav", m("ul", nav_content)),
                m("div", {class: "content"}, this.content(vnode)),
                m("footer", "The preferred certificate authority of Dark Helmet.")];
    }

    content()
    {
        return "";
    }
};

class Blank extends Page
{
    content()
    {
        return m("div", {class: "empty"}, Icons.certificate());
    }
};


function link(url_base, url_end, link_name, icon = null)
{
    link_name = Icons.addTo(link_name, icon);
    return m(m.route.Link, {href: `${url_base}/${url_end}`}, link_name);
}

function downloadLink(url_base, file_name, link_name, icon=null)
{
    link_name = Icons.addTo(link_name, icon);
    return m("a", {href: `${url_base}/${file_name}`, download: file_name}, link_name);
}

class LoadingPage extends Page
{
    oninit(vnode)
    {
        state = {_ready:  false,
                 _failed: false,
                 _attrs:  vnode.attrs};

        this.request(vnode).then(
            function success()
            {
                state._ready = true;
                m.redraw();
            },
            function failure()
            {
                state._failed = true;
                m.redraw();
            });
    }

    onupdate(vnode)
    {
        if (state._attrs != vnode.attrs)
        {
            // We need to load new data, so we will treat this the same as
            // initialization.
            this.oninit(vnode);
        }
    }

    request()
    {
        return Promise.resolve();
    }

    content(vnode)
    {
        if (state._ready)
        {
            return this.loadedContent(vnode);
        }
        if (state._failed)
        {
            //! @todo Make this nicer.
            return m("strong", 404);
        }
        else
        {
            return m("div",
                     {class: "loading"},
                     Icons.compactDisc({class: "spinner"}));
        }
    }

    loadedContent()
    {
        return "";
    }
};


class CertList extends LoadingPage
{
    request(vnode)
    {
        return (m.request({method: "GET",
                           url:    `/api/${vnode.attrs.type}`})
                .then((data) => {
                    state.certificates = data;
                }));
    }

    loadedContent(vnode)
    {
        const text_route_base = `/${vnode.attrs.type}/text`;
        const file_url_base   = `/files/${vnode.attrs.type}`;

        let certs = [];
        for (const cert_name in state.certificates)
        {
            if (state.certificates.hasOwnProperty(cert_name))
            {
                const properties = state.certificates[cert_name];

                let cert = null;
                if (properties.certificate)
                {
                    cert = [" ", link(text_route_base,
                                      properties.certificate,
                                      "View",
                                      "eye"),
                            " ", downloadLink(file_url_base,
                                              properties.certificate,
                                              "Certificate",
                                              "certificate")];
                }
                let key  = null;
                if (properties.key)
                {
                    key = [" ", downloadLink(file_url_base,
                                             properties.key,
                                             "Key",
                                             "key")];
                }

                certs.push(m("li", [cert_name,
                                    m("span", {class: "files"}, [cert, key])]));
            }
        }

        return m("ul", {class: "cert-list"}, certs);
    }
};

class CertText extends LoadingPage
{
    request(vnode)
    {
        const {type, certificate} = vnode.attrs;

        return (m.request({method:       "GET",
                         url:          `api/${type}/text/${certificate}`,
                         responseType: "text"})
                .then((data) => {
                    state.certificate_text = data;
                }));
    }

    loadedContent(vnode)
    {
        if (state.certificate_text)
        {
            return m("pre", state.certificate_text);
        }
        else
        {
            return m("strong", "Error reading the certificate file.");
        }
    }
};


m.route(root, "/", {
    "/":                        Blank,
    "/:type":                   CertList,
    "/:type/text/:certificate": CertText
});
