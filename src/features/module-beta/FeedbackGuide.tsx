'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  CircleHelp,
  ClipboardCheck,
  MessageSquare,
  MousePointerClick,
  Square,
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/*
 * A one-screen picture of how beta feedback works: open a module, report problems where they
 * happen, show where, and finish with an overall review. It opens by itself the first time a
 * reviewer reaches the hub on a browser, and from "How to give feedback" on the hub and in every
 * module's top bar after that. Server mode only: owner-local review has no overall review and
 * no reviewers to introduce.
 */
export const feedbackGuideSeenKey = 'module-beta:feedback-guide-seen:v1'

function hasSeenGuide() {
  try {
    return window.localStorage.getItem(feedbackGuideSeenKey) === '1'
  } catch {
    return false
  }
}

const noSubscription = () => () => {}

function rememberGuideSeen() {
  try {
    window.localStorage.setItem(feedbackGuideSeenKey, '1')
  } catch {}
}

/* The pictures echo the real controls, at small scale, and are hidden from screen readers: each
   step's text says everything the picture shows. */
function Picture({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-32 select-none flex-col overflow-hidden rounded-lg border bg-muted/40 p-3 text-[10px] leading-none"
    >
      {children}
    </div>
  )
}

const pill = 'inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold whitespace-nowrap'
const callout = 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'

function OpenPicture() {
  return (
    <Picture>
      <div className="flex flex-1 flex-col justify-between rounded-md border bg-background p-2.5">
        <div className="space-y-1.5">
          <div className="h-2 w-3/4 rounded bg-foreground/70" />
          <div className="h-1.5 w-full rounded bg-muted-foreground/30" />
          <div className="h-1.5 w-5/6 rounded bg-muted-foreground/30" />
        </div>
        <div className="relative self-start">
          <span className={`${pill} bg-primary text-primary-foreground ${callout}`}>
            Test with feedback <ArrowUpRight className="h-3 w-3" />
          </span>
          <MousePointerClick className="absolute -bottom-2 -right-4 h-4 w-4 text-foreground" />
        </div>
      </div>
    </Picture>
  )
}

function ReportPicture() {
  return (
    <Picture>
      <div className="flex items-center gap-2 rounded-t-md border bg-background px-2 py-1.5">
        <ArrowLeft className="h-3 w-3 shrink-0" />
        <span className="h-1.5 flex-1 rounded bg-foreground/50" />
        <span className={`${pill} bg-primary text-primary-foreground ${callout}`}>
          <MessageSquare className="h-3 w-3" /> Give feedback
        </span>
      </div>
      <div className="flex-1 space-y-1.5 rounded-b-md border border-t-0 bg-background p-2.5">
        <div className="h-1.5 w-full rounded bg-muted-foreground/30" />
        <div className="flex gap-1">
          <div className="h-1.5 w-1/4 rounded bg-muted-foreground/30" />
          <div className="h-2.5 w-2/4 -translate-y-0.5 rounded-sm bg-primary/30" />
          <div className="h-1.5 w-1/4 rounded bg-muted-foreground/30" />
        </div>
        <div className="h-1.5 w-4/5 rounded bg-muted-foreground/30" />
        <div className="h-1.5 w-3/5 rounded bg-muted-foreground/30" />
      </div>
    </Picture>
  )
}

function ShowWherePicture() {
  return (
    <Picture>
      <div className="relative flex-1 rounded-md border bg-background p-2.5">
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded bg-muted-foreground/30" />
          <div className="h-1.5 w-2/3 rounded bg-muted-foreground/30" />
        </div>
        <div className="mt-2 h-8 w-3/5 rounded bg-muted-foreground/20" />
        <div className="absolute bottom-2 left-1.5 h-11 w-[64%] rounded-sm border-2 border-red-500" />
        <ArrowUpRight className="absolute bottom-8 right-6 h-6 w-6 rotate-180 text-red-500" />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className={`${pill} bg-primary text-primary-foreground`}>
          <Camera className="h-3 w-3" /> Capture this tab
        </span>
        {[Square, ArrowUpRight, Type].map((Tool, index) => (
          <span key={index} className={`${pill} border bg-background px-1.5`}>
            <Tool className="h-3 w-3" />
          </span>
        ))}
      </div>
    </Picture>
  )
}

function ReviewPicture() {
  return (
    <Picture>
      <div className="flex-1 space-y-2 rounded-md border bg-background p-2.5">
        <div className="h-1.5 w-1/2 rounded bg-foreground/60" />
        <div className="flex gap-1">
          {['1', '2', '3', '4', '5'].map((score) => (
            <span
              key={score}
              className={`${pill} min-w-6 justify-center border ${
                score === '4'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background'
              }`}
            >
              {score}
            </span>
          ))}
        </div>
        <span className={`${pill} border border-primary bg-primary/10 font-medium`}>
          Ready after minor fixes
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-muted-foreground">
        <ClipboardCheck className="h-3 w-3" /> Overall review: submitted · Edit
      </p>
    </Picture>
  )
}

const steps = [
  {
    title: 'Open a module',
    picture: <OpenPicture />,
    body: (
      <>
        Choose <strong>Test with feedback</strong> on its card. The module opens with a feedback bar
        along the top; <strong>All modules</strong> takes you back to the list.
      </>
    ),
  },
  {
    title: 'Report problems as you go',
    picture: <ReportPicture />,
    body: (
      <>
        Click <strong>Give feedback</strong> on the page where you see it. One problem per report:
        what happened and what you expected. Select text in the module first to quote it.
      </>
    ),
  },
  {
    title: 'Show us where',
    picture: <ShowWherePicture />,
    body: (
      <>
        If it helps, <strong>Capture this tab</strong> or upload an image, then mark it with a box,
        arrow or note. Leave out patient information.
      </>
    ),
  },
  {
    title: 'Finish with an overall review',
    picture: <ReviewPicture />,
    body: (
      <>
        About 3 minutes per module: quality, readiness, and questions matched to the role in your
        site profile. You can edit it later, and each module’s card shows whether it’s done.
      </>
    ),
  },
]

export function FeedbackGuide({ placement }: { placement: 'hub' | 'toolbar' }) {
  // Read after hydration; the server renders the guide closed.
  const seen = useSyncExternalStore(noSubscription, hasSeenGuide, () => true)
  const [chosen, setChosen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // The first visit to the hub on this browser opens the guide; the module bar never does.
  const open = chosen || (placement === 'hub' && !seen && !dismissed)
  function onOpenChange(value: boolean) {
    setChosen(value)
    if (!value) {
      setDismissed(true)
      rememberGuideSeen()
    }
  }
  return (
    <>
      {placement === 'hub' ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setChosen(true)}>
          <CircleHelp className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          How to give feedback
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setChosen(true)}
          data-feedback-guide-button
          className="-my-1 inline-flex items-center gap-1 rounded-sm py-1 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          How to give feedback
        </button>
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90dvh] max-w-5xl overflow-y-auto p-5 sm:p-6"
          data-feedback-guide
        >
          <DialogHeader>
            <DialogTitle>How to give feedback</DialogTitle>
            <DialogDescription>
              Four steps. Open this again any time from <strong>How to give feedback</strong>, on
              the module list or in a module’s top bar.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="space-y-3">
                {step.picture}
                <h3 className="flex items-baseline gap-2 text-sm font-semibold">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {index + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground">
              Reports go only to the site team, once you click <strong>Send feedback</strong>. A
              report you haven’t sent is lost if you reload or leave the module.
            </p>
            <Button type="button" className="shrink-0" onClick={() => onOpenChange(false)}>
              {placement === 'hub' ? 'Start testing' : 'Back to the module'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
