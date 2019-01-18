import { Method } from "../Method";
import { MethodMetadataArgs } from "./args/MethodMetadataArgs";
import { MethodType } from "./types/MethodType";
import { ClassTransformOptions } from "class-transformer";
import { ControllerMetadata } from "./ControllerMetadata";
import { ParamMetadata } from "./ParamMetadata";
import { ResponseHandlerMetadata } from "./ResponseHandleMetadata";
import { ApplicationOptions } from "../ApplicationOptions";

/**
 * Method metadata.
 */
export class MethodMetadata {

    // -------------------------------------------------------------------------
    // Properties
    // -------------------------------------------------------------------------

    /**
     * Method's controller.
     */
    controllerMetadata: ControllerMetadata;

    /**
     * Method's parameters.
     */
    params: ParamMetadata[];

    /**
     * Class on which's method this method is attached.
     */
    target: Function;

    /**
     * Object's method that will be executed on this method.
     */
    method: string;

    /**
     * Method type represents http method used for the registered name. Can be one of the value defined in MethodTypes
     * class.
     */
    type: MethodType;

    /**
     * Route to be registered for the method.
     */
    name: string | RegExp;

    /**
     * Full name to this method (includes controller base name).
     */
    fullRoute: string | RegExp;

    /**
     * Class-transformer options for the method response content.
     */
    responseClassTransformOptions: ClassTransformOptions;

    /**
     * Http code to be used on undefined method returned content.
     */
    undefinedResultCode: number | Function;

    /**
     * Http code to be used on null method returned content.
     */
    nullResultCode: number | Function;

    /**
     * Http code to be set on successful response.
     */
    successHttpCode: number;

    /**
     * Response headers to be set.
     */
    headers: { [name: string]: any };

    /**
     * Extra options used by @Body decorator.
     */
    bodyExtraOptions: any;

    /**
     * Params to be appended to the method call.
     */
    appendParams?: (method: Method) => any[];

    /**
     * Special function that will be called instead of orignal method of the target.
     */
    methodOverride?: (methodMetadata: MethodMetadata, method: Method, params: any[]) => Promise<any> | any;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(controllerMetadata: ControllerMetadata, args: MethodMetadataArgs, private options: ApplicationOptions) {
        this.controllerMetadata = controllerMetadata;
        this.name = args.name;
        this.target = args.target;
        this.method = args.method;
        this.type = args.type;
        this.appendParams = args.appendParams;
        this.methodOverride = args.methodOverride;
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Builds everything method metadata needs.
     * Method metadata can be used only after its build.
     */
    build(responseHandlers: ResponseHandlerMetadata[]) {
        const classTransformerResponseHandler = responseHandlers.find(handler => handler.type === "response-class-transform-options");
        const undefinedResultHandler = responseHandlers.find(handler => handler.type === "on-undefined");
        const nullResultHandler = responseHandlers.find(handler => handler.type === "on-null");
        const successCodeHandler = responseHandlers.find(handler => handler.type === "success-code");
        const redirectHandler = responseHandlers.find(handler => handler.type === "redirect");
        const renderedTemplateHandler = responseHandlers.find(handler => handler.type === "rendered-template");
        const authorizedHandler = responseHandlers.find(handler => handler.type === "authorized");
        const contentTypeHandler = responseHandlers.find(handler => handler.type === "content-type");
        const bodyParam = this.params.find(param => param.type === "body");

        if (classTransformerResponseHandler)
            this.responseClassTransformOptions = classTransformerResponseHandler.value;

        this.undefinedResultCode = undefinedResultHandler
            ? undefinedResultHandler.value
            : this.options.defaults && this.options.defaults.undefinedResultCode;

        this.nullResultCode = nullResultHandler
            ? nullResultHandler.value
            : this.options.defaults && this.options.defaults.nullResultCode;

        if (successCodeHandler)
            this.successHttpCode = successCodeHandler.value;

        this.fullRoute = this.buildFullRoute();
        this.headers = this.buildHeaders(responseHandlers);
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    /**
     * Builds full method name.
     */
    private buildFullRoute(): string | RegExp {
        if (this.name instanceof RegExp) {
            if (this.controllerMetadata.name) {
                return MethodMetadata.appendBaseRoute(this.controllerMetadata.name, this.name);
            }
            return this.name;
        }

        let path: string = "";
        if (this.controllerMetadata.name) path += this.controllerMetadata.name;
        if (this.name && typeof this.name === "string") path += this.name;
        return path;
    }

    /**
     * Builds method response headers.
     */
    private buildHeaders(responseHandlers: ResponseHandlerMetadata[]) {
        const contentTypeHandler = responseHandlers.find(handler => handler.type === "content-type");

        const headers: { [name: string]: string } = {};

        if (contentTypeHandler)
            headers["Content-type"] = contentTypeHandler.value;

        const headerHandlers = responseHandlers.filter(handler => handler.type === "header");
        if (headerHandlers)
            headerHandlers.map(handler => headers[handler.value] = handler.secondaryValue);

        return headers;
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Calls method method.
     * Method method is an method defined in a user controller.
     */
    callMethod(params: any[]) {
        const controllerInstance = this.controllerMetadata.instance;
        return controllerInstance[this.method].apply(controllerInstance, params);
    }

    // -------------------------------------------------------------------------
    // Static Methods
    // -------------------------------------------------------------------------

    /**
     * Appends base name to a given regexp name.
     */
    static appendBaseRoute(baseRoute: string, name: RegExp | string) {
        const prefix = `${baseRoute.length > 0 && baseRoute.indexOf("/") < 0 ? "/" : ""}${baseRoute}`;
        if (typeof name === "string")
            return `${prefix}${name}`;

        if (!baseRoute || baseRoute === "") return name;

        const fullPath = `^${prefix}${name.toString().substr(1)}?$`;

        return new RegExp(fullPath, name.flags);
    }

}