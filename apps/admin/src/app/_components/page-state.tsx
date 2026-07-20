import { Button } from "@acme/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/card";
import { Skeleton } from "@acme/ui/skeleton";

type PageStateProps =
  | {
      state: "loading";
      title?: string;
    }
  | {
      description?: string;
      state: "empty";
      title: string;
    }
  | {
      description?: string;
      onRetry?: () => void;
      state: "error";
      title?: string;
    };

export function PageState(props: PageStateProps) {
  if (props.state === "loading") {
    return (
      <Card aria-busy="true" aria-label="Loading">
        <CardHeader>
          <CardTitle>{props.title ?? "Loading"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </CardContent>
      </Card>
    );
  }

  if (props.state === "empty") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          {props.description ? (
            <CardDescription>{props.description}</CardDescription>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>{props.title ?? "Unable to load data"}</CardTitle>
        <CardDescription>
          {props.description ?? "The request failed. Please try again."}
        </CardDescription>
      </CardHeader>
      {props.onRetry ? (
        <CardContent>
          <Button onClick={props.onRetry} variant="outline">
            Try again
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
