import {Method} from "../../Method";
import {MethodMetadata} from "../../metadata/MethodMetadata";
import {BaseDriver} from "../BaseDriver";
import {ParamMetadata} from "../../metadata/ParamMetadata";
import {isPromiseLike} from "../../helpers/isPromiseLike";
import {getFromContainer} from "../../container";
import {RpcError} from "../../rpc-error/RpcError";

const cookie = require("cookie");

/**
 * Integration with koa framework.
 */
export class KoaDriver extends BaseDriver {

    constructor(public koa?: any, public router?: any) {
        super();
        this.loadKoa();
        this.loadRouter();
        this.app = this.koa;
    }

    /**
     * Initializes the things driver needs before routes and middleware registration.
     */
    initialize() {
        const bodyParser = require("koa-bodyparser");
        this.koa.use(bodyParser());
        if (this.cors) {
            const cors = require("kcors");
            if (this.cors === true) {
                this.koa.use(cors());
            } else {
                this.koa.use(cors(this.cors));
            }
        }
    }

    /**
     * Registers action in the driver.
     */
    registerMethod(actionMetadata: MethodMetadata, executeCallback: (options: Method) => any): void {

        // prepare route and route handler function
        const route = MethodMetadata.appendBaseRoute(this.routePrefix, actionMetadata.fullRoute);
        const routeHandler = (context: any, next: () => Promise<any>) => {
            const options: Method = {request: context.request, response: context.response, context, next};
            return executeCallback(options);
        };

        // finally register action in koa
        this.router[actionMetadata.type.toLowerCase()](...[
            route,
            routeHandler,
        ]);
    }

    /**
     * Registers all routes in the framework.
     */
    registerRoutes() {
        this.koa.use(this.router.routes());
        this.koa.use(this.router.allowedMethods());
    }

    /**
     * Gets param from the request.
     */
    getParamFromRequest(actionOptions: Method, param: ParamMetadata): any {
        const context = actionOptions.context;
        const request: any = actionOptions.request;
        switch (param.type) {
            case "body":
                return request.body;

            case "body-param":
                return request.body[param.name];

            case "param":
                return context.params[param.name];

            case "params":
                return context.params;

            case "session":
                if (param.name)
                    return context.session[param.name];
                return context.session;

            case "state":
                if (param.name)
                    return context.state[param.name];
                return context.state;

            case "query":
                return context.query[param.name];

            case "queries":
                return context.query;

            case "file":
                return actionOptions.context.req.file;

            case "files":
                return actionOptions.context.req.files;

            case "header":
                return context.headers[param.name.toLowerCase()];

            case "headers":
                return request.headers;

            case "cookie":
                if (!context.headers.cookie) return;
                const cookies = cookie.parse(context.headers.cookie);
                return cookies[param.name];

            case "cookies":
                if (!request.headers.cookie) return {};
                return cookie.parse(request.headers.cookie);
        }
    }

    /**
     * Handles result of successfully executed controller action.
     */
    handleSuccess(result: any, action: MethodMetadata, options: Method): void {

        // if the action returned the context or the response object itself, short-circuits
        if (result && (result === options.response || result === options.context)) {
            return options.next();
        }

        // transform result if needed
        result = this.transformResult(result, action, options);

        if (result === undefined) { // throw NotFoundError on undefined response
            if (action.undefinedResultCode instanceof Function) {
                throw new (action.undefinedResultCode as any)(options);

            } else if (!action.undefinedResultCode) {
                // throw new NotFoundError();
            }
        }
        // todo send null response

        // todo set http status code
        

        // apply http headers
        Object.keys(action.headers).forEach(name => {
            options.response.set(name, action.headers[name]);
        });

        return options.next();
    }

    /**
     * Handles result of failed executed controller action.
     */
    handleError(error: any, action: MethodMetadata | undefined, options: Method) {
        return new Promise((resolve, reject) => {
            if (this.isDefaultErrorHandlingEnabled) {

                // apply http headers
                if (action) {
                    Object.keys(action.headers).forEach(name => {
                        options.response.set(name, action.headers[name]);
                    });
                }

                // send error content
                    options.response.body = this.processJsonError(error);
                
                // todo set http status
                

                return resolve();
            }
            return reject(error);
        });
    }

    /**
     * Dynamically loads koa and required koa-router module.
     */
    protected loadKoa() {
        if (require) {
            if (!this.koa) {
                try {
                    this.koa = new (require("koa"))();
                } catch (e) {
                    throw new Error("koa package was not found installed. Try to install it: npm install koa@next --save");
                }
            }
        } else {
            throw new Error("Cannot load koa. Try to install all required dependencies.");
        }
    }

    /**
     * Dynamically loads koa-router module.
     */
    private loadRouter() {
        if (require) {
            if (!this.router) {
                try {
                    this.router = new (require("koa-router"))();
                } catch (e) {
                    throw new Error("koa-router package was not found installed. Try to install it: npm install koa-router@next --save");
                }
            }
        } else {
            throw new Error("Cannot load koa. Try to install all required dependencies.");
        }
    }

}