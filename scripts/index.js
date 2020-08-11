"use strict"

import m from "mithril";

import Icons from "./icons.js"


let root  = document.body;
let state = {ready: false};

class Page
{
    view()
    {
        return [m("header", m("h1", "Mr. Cert")),
                m("nav", m("ul", [m("li", m(m.route.Link, {href: "/root"}, "CA Roots")),
                                  m("li", m("a", "CA Intermediates")),
                                  m("li", m("a", "Client Certificates"))])),
                m("div", {class: "content"}, this.content()),
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
    oninit()
    {
        state = {ready: false};

        this.request().then(() => {
            state.ready = true;
            m.redraw()
        });
    }

    request()
    {
        return Promise.resolve();
    }

    content()
    {
        if (state.ready)
        {
            return this.loadedContent();
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
    request()
    {
        return (m.request({method: "GET",
                           url:    "/api/root"})
                .then((data) => {
                    state.certificates = data;
                }));
    }

    loadedContent()
    {
        let certs = [];
        for (const cert_name in state.certificates)
        {
            if (state.certificates.hasOwnProperty(cert_name))
            {
                const properties = state.certificates[cert_name];

                let cert = null;
                if (properties.certificate)
                {
                    cert = [" ", link("/root/text",
                                      properties.certificate,
                                      "View",
                                      "eye"),
                            " ", downloadLink("/root/files",
                                              properties.certificate,
                                              "Certificate",
                                              "certificate")];
                }
                let key  = null;
                if (properties.key)
                {
                    key = [" ", downloadLink("/root/files",
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


m.route(root, "/", {
    "/":     Blank,
    "/root": CertList
});
