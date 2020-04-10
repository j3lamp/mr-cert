const Koa    = require("koa");
const Router = require("koa-router");


module.exports = class Server
{
    constructor()
    {
        this.http_server = new Koa();

        let router = new Router();

        router.get("/", (context, next) => {
            context.body  = "<html><head><title>Mr. Cert</title></head>";
            context.body += "<body><h1>Mr. Cert</h1>"
            context.body += `<p class="tagline">The preferred certificate authority of Dark Helmet</p>`;
            context.body += "</body></html>";
        });

        this.http_server.use(router.routes())
                        .use(router.allowedMethods());
    }

    listen(port)
    {
        this.http_server.listen(port);
    }
};
