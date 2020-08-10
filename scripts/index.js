"use strict"

import m      from "mithril";
import * as F from "@mithril-icons/font-awesome";



let root = document.body;

class Page
{
    view()
    {
        return [m("header", m("h1", "Mr. Cert")),
                m("nav", m("ul", [m("li", m("a", "CA Roots")),
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
        return m("div", {class: "empty"}, m(F.solid.Certificate));
    }
};


m.route(root, "/", {
    "/": Blank,
    // "/": m(Blank, m("div", {class: "empty"}, m(F.solid.Certificate)))
});
1
