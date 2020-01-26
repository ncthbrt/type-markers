import { Decoder, object, string } from 'decoders';

/* If you have multiple possible candidates for an inferred type, the compiler
* can return either a union or an intersection depending on how those 
*candidates are used. 
*
* ((() => A) | (() => B)) extends (() => infer T) ?T: never 
* will produce A | B because function types are covariant in their return type.
* But((x: A) => void) | ((y: B) => void) 
*    extends ((z: infer T) => void) ? T : never 
* will produce A & B because function types are contravariant in their argument
* types
*/
type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends
    ((k: infer I) => void) ? I : never

type TransitionResult = 'transitioned';
type PromiseOrResult<T> = Promise<T> | T;

type NodeState<Context> = { ctx: Context };
type FieldDefinition<Context> =
    (state: NodeState<Context>, arg: any) => any;


type GraphNode<Context, Nodes extends GraphNodes<Context, Nodes>> = {
    arg?: Decoder<any>,
    asserts?: (ctx: Context, nodeState: NodeState<Context>) => void,
    fields?: {
        [key: string]: FieldDefinition<Context>
    },
    edges?: {
        [Node in keyof Nodes]?:
        (Nodes[Node]['arg']) extends Decoder<infer Arg>
        ? ((arg: Arg, ctx: Context) => PromiseOrResult<TransitionResult>)
        : ((ctx: Context) => PromiseOrResult<TransitionResult>)
    }
};



export type GraphNodes<Context, Self extends GraphNodes<Context, Self>> = { [key: string]: GraphNode<Context, Self> };



type InferField<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends GraphNode<Context, Nodes>, Field extends Node['fields']> =
    Field extends ((state: NodeState<Context>, arg: infer Arg) => infer Result)
    ? (arg: Arg) => Result
    : (
        Field extends (((state: NodeState<Context>) => infer Result))
        ? () => Result
        : (Field extends (() => infer Result) ? () => Result : never)
    );


type BuiltGraphTransitionResult<Context, Nodes extends GraphNodes<Context, Nodes>, NodeName extends keyof Nodes> =
    ({
        transitionResult: 'successful',
        name: NodeName,
        fields: {
            [Field in keyof (Nodes[NodeName]['fields'])]: InferField<Context, Nodes, Nodes[NodeName], Nodes[NodeName]['fields'][Field]>
        }
    });

type BuiltGraph<Context, Nodes extends GraphNodes<Context, Nodes>> =
    { currentNode: { name: keyof Node } } &
    {
        [Node in keyof Nodes]:
        Nodes[Node] extends { arg: Decoder<infer NodeArg> }
        ? (arg: NodeArg) => Promise<BuiltGraphTransitionResult<Context, Nodes, Node>>
        : () => Promise<BuiltGraphTransitionResult<Context, Nodes, Node>>
    };


export function build<Context, Nodes extends GraphNodes<Context, Nodes>>(_nodes: Nodes, context: Context): BuiltGraph<Context, Nodes> {
    return {} as BuiltGraph<Context, Nodes>;
}

const graph = build({
    FROG: {
        asserts: () => { },
        arg: object({
            name: string
        }),
        fields: {
            legs: (_state, arg: { includeToes: boolean }) => 4
        }
    },
    CATS: {
        fields: {
            claws: () => 10,
            legs: (state, arg: { includeToes: boolean, includeBacklegs: boolean }) => arg.includeBacklegs ? 4 : 2
        },
        edges: {
            FROG: (args: { name: string }, ctx: unknown) => args.name === 'benny' ? 'transitioned' : 'transitioned',
        }
    }
}, {});

async function testFunction() {
    const frog = await graph.CATS();
    const result = frog.fields.legs({ includeToes: true, includeBacklegs: true });
}
